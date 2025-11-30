# this version includes the explicit cache stratgey and detailed stroage cost calculation and it is only for paid tiers

from google import genai
from google.genai import types
import base64
import json
import uuid
import requests
import asyncio
import datetime
from io import BytesIO
from typing import AsyncGenerator, Dict, Any

# Import the new pricing service
from pricing import PricingService

class AnalysisService:
    """Service for handling data analysis using Google GenAI."""
    
    def __init__(self, api_key: str):
        """Initialize the analysis service with Google GenAI client."""
        self.client = genai.Client(api_key=api_key)
        self.pricing_service = PricingService()
        self._chat_sessions = {}

    # ==================== Private Helper Methods ====================
    
    async def _upload_file(self, file_content: bytes, filename: str, content_type: str):
        """Uploads a file to Google GenAI."""
        print(f"Starting file upload: {filename} ({content_type})")
        file_obj = BytesIO(file_content)
        file_obj.name = filename
        
        try:
            upload_result = await self.client.aio.files.upload(
                file=file_obj,
                config=types.FileDict(display_name=filename, mime_type=content_type)
            )
            print(f"File uploaded to temporary storage: {upload_result.name}")
            return upload_result
        except Exception as e:
            print(f"Error uploading file: {e}")
            raise e

    async def _upload_and_cache_file(self, file_content: bytes, filename: str, content_type: str, ttl_minutes: int = 10, model: str = "gemini-2.5-flash"):
        """
        1. Uploads file to File API.
        2. Creates a Context Cache from that file.
        Returns the cache object.
        """
        try:
            # Step A: Standard Upload (Required before caching)
            upload_result = await self._upload_file(file_content, filename, content_type)

            # Step B: Create Context Cache
            # We explicitly tell Gemini to cache this file content.
            ttl_seconds = f"{ttl_minutes * 60}s"
            
            print(f"Creating cache with TTL={ttl_seconds}...")
            
            # Ensure model has 'models/' prefix for cache creation if not present
            cache_model = model if model.startswith("models/") else f"models/{model}"
            
            cache_result = await self.client.aio.caches.create(
                model=cache_model, 
                config=types.CreateCachedContentConfig(
                    contents=[upload_result], # Pass the file object/URI here
                    display_name=f"cache_{filename}",
                    ttl=ttl_seconds,
                    # Move tools definition to the cache config
                    tools=[types.Tool(code_execution=types.ToolCodeExecution)],
                )
            )
            print(f"Cache created successfully: {cache_result.name}")
            return cache_result

        except Exception as e:
            print(f"Error in upload_and_cache: {e}")
            raise e
        
    async def _update_cache_heartbeat(self, cache_name: str, ttl_minutes: int = 10):
        """
        Resets the TTL (Time-To-Live) for an existing cache.
        This acts as the 'Heartbeat' to keep the session alive.
        """
        try:
            ttl_seconds = f"{ttl_minutes * 60}s"
            await self.client.aio.caches.update(
                name=cache_name,
                config=types.UpdateCachedContentConfig(ttl=ttl_seconds)
            )
            print(f"💓 Heartbeat sent for {cache_name}. TTL reset to {ttl_minutes} mins.")
        except Exception as e:
            print(f"Failed to update heartbeat: {e}")
            # Don't raise; we don't want to crash the chat just because heartbeat failed
            pass


    # ==================== 2. Helper Methods ====================
    def _get_chat_config(self, cache_name: str = None) -> types.GenerateContentConfig:
        """
        Get chat config, optionally binding it to a Cached Content block.
        """
        # Base config with thinking mode (allowed in both cases)
        config_args = {
            "thinking_config": types.ThinkingConfig(include_thoughts=True)
        }

        # If we have a cache, we attach it. Tools must NOT be redeclared here.
        if cache_name:
            config_args["cached_content"] = cache_name
        else:
            # If NO cache, we must declare tools here.
            config_args["tools"] = [types.Tool(code_execution=types.ToolCodeExecution)]
            
        return types.GenerateContentConfig(**config_args)

    def _download_file_sync(self, file_obj):
        """Synchronous helper to download file content."""
        if hasattr(file_obj, 'download'):
            return file_obj.download()
        elif hasattr(file_obj, 'uri'):
            # Add API key to headers for authenticated access
            headers = {}
            if self.client.api_key:
                headers["x-goog-api-key"] = self.client.api_key
            
            response_file = requests.get(file_obj.uri, headers=headers)
            response_file.raise_for_status()
            return response_file.content
        else:
            raise ValueError(f"No download method available for file object")

    async def _serialize_part(self, part) -> Dict[str, Any]:
        """
        Serialize a GenAI response part to a dictionary.
        
        Args:
            part: A part from the GenAI response
            
        Returns:
            Dictionary representation of the part
        """
        part_dict = {}
        
        if part.text:
            part_dict["text"] = part.text
        
        if hasattr(part, 'executable_code') and part.executable_code:
            part_dict["executableCode"] = {
                "language": part.executable_code.language,
                "code": part.executable_code.code
            }
        
        if hasattr(part, 'code_execution_result') and part.code_execution_result:
            part_dict["codeExecutionResult"] = {
                "outcome": part.code_execution_result.outcome,
                "output": part.code_execution_result.output
            }
        
        if hasattr(part, 'inline_data') and part.inline_data:
            data_b64 = base64.b64encode(part.inline_data.data).decode('utf-8')
            part_dict["inlineData"] = {
                "mimeType": part.inline_data.mime_type,
                "data": data_b64
            }
        
        # Handle file_data (URI based files)
        if hasattr(part, 'file_data') and part.file_data:
            try:
                # Get the file object from Google's service
                file_uri = part.file_data.file_uri
                
                # The SDK's get() method expects 'files/ID', not the full URL
                file_name_arg = file_uri
                if "/files/" in file_uri:
                    # Extract everything after and including "files/"
                    # e.g. https://generativelanguage.googleapis.com/v1beta/files/abc -> files/abc
                    file_name_arg = "files/" + file_uri.split("/files/")[-1]
                
                file_obj = await self.client.aio.files.get(name=file_name_arg)
                file_name = getattr(file_obj, 'display_name', 'downloaded_file')
                
                # Download file content in a separate thread to avoid blocking
                file_content = await asyncio.to_thread(self._download_file_sync, file_obj)
                
                # Encode the file content to base64
                file_b64 = base64.b64encode(file_content).decode('utf-8')
                
                part_dict["fileData"] = {
                    "mimeType": part.file_data.mime_type,
                    "data": file_b64,
                    "name": file_name
                }
                
            except requests.exceptions.RequestException as req_error:
                print(f"Network error downloading file {part.file_data.file_uri}: {req_error}")
                part_dict["fileData"] = {
                    "mimeType": part.file_data.mime_type,
                    "fileUri": part.file_data.file_uri,
                    "error": f"Network error: {str(req_error)}"
                }
            except Exception as file_error:
                import traceback
                traceback.print_exc()
                print(f"Error processing file {part.file_data.file_uri}: {file_error}")
                part_dict["fileData"] = {
                    "mimeType": part.file_data.mime_type,
                    "fileUri": part.file_data.file_uri,
                    "error": f"Processing error: {str(file_error)}"
                }
        
        return part_dict

    async def _stream_response(self, response, accumulated_parts: list = None, model: str = "gemini-2.5-flash"):
        """
        Stream and serialize GenAI response parts asynchronously.
        Calculates cost at the end using PricingService.
        
        Args:
            response: The GenAI async response iterator
            accumulated_parts: List to accumulate parts for text continuation
            model: The model used for the request, for cost calculation
            
        Yields:
            JSON strings containing response parts
        """
        if accumulated_parts is None:
            accumulated_parts = []
        
        final_usage_metadata = None
        
        # Helper to handle both async and sync iterables
        async def to_async_iter(iterable):
            if hasattr(iterable, '__aiter__'):
                async for item in iterable:
                    yield item
            else:
                for item in iterable:
                    yield item

        try:
            async for chunk in to_async_iter(response):
                # Capture usage metadata from chunk if available
                if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata:
                    final_usage_metadata = chunk.usage_metadata

                if chunk.candidates and len(chunk.candidates) > 0:
                    for part in chunk.candidates[0].content.parts:
                        part_dict = await self._serialize_part(part)
                        
                        if part_dict:
                            if "text" in part_dict and accumulated_parts and "text" in accumulated_parts[-1]:
                                accumulated_parts[-1]["text"] += part_dict["text"]
                            else:
                                accumulated_parts.append(part_dict)
                            # Yield the current state as JSON
                            yield json.dumps(accumulated_parts) + "\n"
            
            # Calculate and append cost data using the external PricingService
            if final_usage_metadata:
                cost_data = self.pricing_service.calculate_interaction_cost(
                    usage_metadata=final_usage_metadata, 
                    model=model
                )
                if cost_data:
                    accumulated_parts.append({"costData": cost_data})
                    yield json.dumps(accumulated_parts) + "\n"
            else:
                print("Warning: No usage_metadata found in streaming response.")

        except Exception as e:
            print(f"Error during stream processing: {e}")
            raise e

    
    # ==================== Stateful Chat Methods ====================
    
    async def create_chat(
        self,
        file_content: bytes | None = None,
        filename: str | None = None,
        content_type: str | None = None,
        model: str = "gemini-2.5-flash" 
    ) -> str:
        """
        Create a new chat session. 
        If a file is provided, it is UPLOADED AND CACHED immediately.
        """
        chat_id = str(uuid.uuid4())
        print(f"Creating chat session: {chat_id} with model: {model}")
        
        cache_name = None
        
        # 1. Handle File Upload & Caching
        if file_content and filename and content_type:
            # We now use the caching method instead of just raw upload
            cache_obj = await self._upload_and_cache_file(
                file_content, filename, content_type
            )
            cache_name = cache_obj.name
        
        try:
            # 2. Create Chat with Cache Config
            # We pass the cache_name into the config. 
            # The model will now "know" the file content automatically.
            config = self._get_chat_config(cache_name=cache_name)
            
            chat = self.client.aio.chats.create(
                model=model,
                config=config
            )
            
            self._chat_sessions[chat_id] = {
                'chat': chat,
                'model': model,
                'cache_name': cache_name, # Store this so we can heartbeat it
                'cache_created_at': datetime.datetime.now()
            }
            return chat_id
            
        except Exception as e:
            print(f"Failed to create chat: {e}")
            raise e

    async def send_message_to_chat(
        self,
        chat_id: str,
        message: str,
        stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """
        Send a message. 
        CRITICAL: Sends a heartbeat to the cache first!
        """
        if chat_id not in self._chat_sessions:
            raise ValueError(f"Chat session {chat_id} not found")
        
        session_data = self._chat_sessions[chat_id]
        chat = session_data['chat']
        cache_name = session_data.get('cache_name')

        # 1. HEARTBEAT: Keep the cache alive
        if cache_name:
            await self._update_cache_heartbeat(cache_name, ttl_minutes=10)

        # 2. Send Message (No need to attach file again, it's in the cache)
        try:
            if stream:
                response = await chat.send_message_stream(message=message)
            else:
                response = await chat.send_message(message=message)
                response = [response]
            
            async for chunk in self._stream_response(response, model=session_data['model']):
                yield chunk
                
        except Exception as e:
            print(f"Error sending message to chat {chat_id}: {e}")
            raise e

    def delete_chat(self, chat_id: str):
        """
        Delete session AND delete the cache to stop billing.
        """
        if chat_id in self._chat_sessions:
            session = self._chat_sessions[chat_id]
            cache_name = session.get('cache_name')
            
            # Clean up the cache to stop storage costs
            if cache_name:
                try:
                    # Sync deletion (fire and forget)
                    # Note: Ideally this should be async or background task
                    self.client.caches.delete(name=cache_name)
                    print(f"Deleted cache {cache_name}")
                except Exception as e:
                    print(f"Error deleting cache: {e}")

            del self._chat_sessions[chat_id]

    # ==================== One-Shot Analysis Method ====================
    
    async def analyze_file_stream(
        self,
        file_content: bytes | None,
        filename: str | None,
        content_type: str | None,
        query: str,
        model: str = "gemini-2.5-flash"
    ) -> AsyncGenerator[str, None]:
        """
        Analyze a file using Google's GenAI with streaming responses.
        
        Args:
            file_content: The file content as bytes (optional)
            filename: The original filename (optional)
            content_type: The MIME type of the file (optional)
            query: User's analysis query
            model: The GenAI model to use
            
        Yields:
            JSON strings containing analysis parts
        """
        contents = []
        prompt = f"""
            Analyze this financial file based on the following user query: "{query}"
            
            **CORE PROCESS:**
            1. **ANALYZE:** processing the data to find insights.
            2. **VISUALIZE:** Create plots to support your analysis.
            3. **REPORT:** Generate a comprehensive PDF report.
            4. **SUMMARIZE:** Output a final text summary for the user. not only put the summary in the thinking process but also print it to standard output (stdout).
                       
            **PDF REPORTING RULES:**
            - The PDF MUST be generated using the `reportlab` library.
            - The PDF MUST contain:
              - **Title**: A clear title for the report.
              - **Executive Summary**: A text summary of the findings.
              - **Analysis**: Detailed text explaining the data and trends for each chart.
              - **Charts**: All generated charts embedded in the document text analysis.
              - **Conclusion**: A final conclusion summarizing the key insights.
            """
        
        # Upload file if provided
        if file_content and filename and content_type:
            uploaded_file = await self._upload_file(file_content, filename, content_type)
            contents = [prompt, uploaded_file]
        else:
            # Text-only query
            contents = [prompt]

        try:
            # Create chat for one-time analysis
            chat = self.client.aio.chats.create(
                model=model,
                config=self._get_chat_config()
            )

            # Send the combined prompt and content
            message_content = " ".join(str(c) for c in contents) if contents else query
            # Use send_message_stream for streaming (MUST BE AWAITED)
            response = await chat.send_message_stream(message=message_content)
            
            # Stream the response
            async for chunk in self._stream_response(response, model=model):
                yield chunk
        except Exception as e:
            print(f"Error in analyze_file_stream: {e}")
            raise e

