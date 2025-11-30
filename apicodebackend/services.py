# this version is for free tier usage with google genai

from google import genai
from google.genai import types
import base64
import uuid
import requests
import asyncio
from io import BytesIO
from typing import AsyncGenerator, Dict, Any
import json

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
        """Upload a file to Google's GenAI service asynchronously."""
        print(f"Starting file upload: {filename} ({content_type})")
        file_obj = BytesIO(file_content)
        file_obj.name = filename
        try:
            # Use client.aio.files.upload for async upload
            result = await self.client.aio.files.upload(
                file=file_obj,
                config=types.FileDict(display_name=filename, mime_type=content_type)
            )
            print(f"File upload successful: {result.name}")
            return result
        except Exception as e:
            print(f"Error uploading file: {e}")
            raise e

    def _get_chat_config(self) -> types.GenerateContentConfig:
        """Get the standard chat configuration."""
        return types.GenerateContentConfig(
            tools=[types.Tool(code_execution=types.ToolCodeExecution)],
            thinking_config=types.ThinkingConfig(
                include_thoughts=True
            )
        )

    def _download_file_sync(self, file_obj):
        """Synchronous helper to download file content."""
        if hasattr(file_obj, 'download'):
            return file_obj.download()
        elif hasattr(file_obj, 'uri'):
            response_file = requests.get(file_obj.uri)
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
                # Use 'get' with 'files/...' name handling if necessary, but snippet assumes uri works with 'get' name?
                # SDK 'get' usually requires 'files/ID'. part.file_data.file_uri is usually the URI.
                # The original snippet passed file_uri to get(). Let's verify if that works or if we need name parsing.
                # The original snippet: file_obj = await self.client.aio.files.get(name=part.file_data.file_uri)
                # I'll keep it as is to match the "rollback" request precisely.
                
                file_obj = await self.client.aio.files.get(name=part.file_data.file_uri)
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
                
                # Calculate storage cost (10 mins fixed for free tier approximation)
                token_breakdown = cost_data.get("token_breakdown", {})
                cached_tokens = token_breakdown.get("cached_input", 0)
                
                storage_cost = self.pricing_service.calculate_storage_cost(
                    cached_tokens=cached_tokens,
                    duration_minutes=10,
                    model=model
                )
                
                if "cost_breakdown" not in cost_data:
                    cost_data["cost_breakdown"] = {}
                
                cost_data["cost_breakdown"]["storage_cost"] = storage_cost
                cost_data["total_cost"] += storage_cost

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
        Create a new chat session with optional file attachment.
        
        Args:
            file_content: The file content as bytes (optional)
            filename: The original filename (optional)
            content_type: The MIME type of the file (optional)
            model: The GenAI model to use
            
        Returns:
            Chat session ID
        """
        chat_id = str(uuid.uuid4())
        print(f"Creating chat session: {chat_id} with model: {model}")
        
        # Upload file if provided
        uploaded_file = None
        if file_content and filename and content_type:
            uploaded_file = await self._upload_file(file_content, filename, content_type)
        
        try:
            # Create chat with file attachment if available       
            chat = self.client.aio.chats.create(
                model=model,
                config=self._get_chat_config()
            )
            print(f"Chat created successfully via API: {chat_id}")
            
            # Store chat session
            self._chat_sessions[chat_id] = {
                'chat': chat,
                'model': model,
                'uploaded_file': uploaded_file
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
        Send a message to an existing chat session.
        
        Args:
            chat_id: The chat session ID
            message: The message to send
            stream: Whether to stream the response
            
        Yields:
            JSON strings containing response parts
        """
        if chat_id not in self._chat_sessions:
            raise ValueError(f"Chat session {chat_id} not found")
        
        chat_session = self._chat_sessions[chat_id]
        chat = chat_session['chat']
        uploaded_file = chat_session.get('uploaded_file')

        # Prepare the message content
        message_content = message
        if uploaded_file:
            # If there's a pending file, include it in the message
            message_content = [uploaded_file, message]
            # Clear the file so it's not sent again
            chat_session['uploaded_file'] = None
        
        # Send the message
        try:
            if stream:
                # Use send_message_stream for streaming (MUST BE AWAITED)
                response = await chat.send_message_stream(message=message_content)
            else:
                # Use send_message for non-streaming (awaited)
                response = await chat.send_message(message=message_content)
                # For consistency, wrapping non-stream response in list to use same helper
                response = [response] 
            
            # Stream the response
            async for chunk in self._stream_response(response, model=chat_session['model']):
                yield chunk
        except Exception as e:
            print(f"Error sending message to chat {chat_id}: {e}")
            raise e

    def delete_chat(self, chat_id: str):
        """Delete a chat session."""
        if chat_id in self._chat_sessions:
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