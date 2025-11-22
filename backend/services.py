"""
Analysis service module for handling AI-powered data analysis.
This module contains the core business logic for file analysis using Google's GenAI.
"""

from google import genai
from google.genai import types
from fastapi import UploadFile
import os
import base64
from typing import AsyncGenerator, Dict, Any


class AnalysisService:
    """Service for handling data analysis using Google GenAI."""
    
    def __init__(self, api_key: str):
        """Initialize the analysis service with Google GenAI client."""
        self.client = genai.Client(api_key=api_key)
    
    async def analyze_file_stream(
        self,
        file_content: bytes,
        filename: str,
        content_type: str,
        query: str,
        model: str = "gemini-2.5-flash"
    ) -> AsyncGenerator[str, None]:
        """
        Analyze a file using Google's GenAI with streaming responses.
        
        Args:
            file_content: The file content as bytes
            filename: The original filename
            content_type: The MIME type of the file
            query: User's analysis query
            model: The GenAI model to use
            
        Yields:
            JSON strings containing analysis parts
        """
        # Create a BytesIO object from the file content
        from io import BytesIO
        file_obj = BytesIO(file_content)
        file_obj.name = filename
        
        # Upload the file to Google GenAI
        uploaded_file = self.client.files.upload(
            file=file_obj,
            config=types.FileDict(display_name=filename, mime_type=content_type)
        )

        # Construct the analysis prompt
        prompt = f"""
        Analyze this financial file based on the following user query: "{query}"
        
        If the query is generic, provide a comprehensive analysis including trends, key insights, and any anomalies. 
        Generate charts where appropriate. Already provide pdf file as report.
        """

        # Generate content with streaming
        response = self.client.models.generate_content_stream(
            model=model,
            contents=[
                prompt,
                uploaded_file
            ],
            config=types.GenerateContentConfig(
                tools=[types.Tool(code_execution=types.ToolCodeExecution)]
            )
        )
        
        # Stream the response
        import json
        accumulated_parts = []
        
        for chunk in response:
            if chunk.candidates and len(chunk.candidates) > 0:
                for part in chunk.candidates[0].content.parts:
                    part_dict = self._serialize_part(part)
                    
                    if part_dict:
                        accumulated_parts.append(part_dict)
                        # Yield the current state as JSON
                        yield json.dumps(accumulated_parts) + "\n"
    
    def _serialize_part(self, part) -> Dict[str, Any]:
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
        
        if part.executable_code:
            part_dict["executableCode"] = {
                "language": part.executable_code.language,
                "code": part.executable_code.code
            }
        
        if part.code_execution_result:
            part_dict["codeExecutionResult"] = {
                "outcome": part.code_execution_result.outcome,
                "output": part.code_execution_result.output
            }
        
        if part.inline_data:
            data_b64 = base64.b64encode(part.inline_data.data).decode('utf-8')
            part_dict["inlineData"] = {
                "mimeType": part.inline_data.mime_type,
                "data": data_b64
            }
        
        # Handle file_data (URI based files)
        if hasattr(part, 'file_data') and part.file_data:
            try:
                file_obj = self.client.files.get(name=part.file_data.file_uri)
                
                if hasattr(file_obj, 'download'):
                    file_content = file_obj.download()
                else:
                    import requests
                    if hasattr(file_obj, 'uri'):
                        response_file = requests.get(file_obj.uri)
                        file_content = response_file.content
                    else:
                        print(f"Unable to download file: {part.file_data.file_uri}")
                        return part_dict
                
                file_b64 = base64.b64encode(file_content).decode('utf-8')
                
                part_dict["fileData"] = {
                    "mimeType": part.file_data.mime_type,
                    "data": file_b64,
                    "name": getattr(file_obj, 'display_name', 'downloaded_file')
                }
            except Exception as file_error:
                print(f"Error downloading file: {file_error}")
                part_dict["fileData"] = {
                    "mimeType": part.file_data.mime_type,
                    "fileUri": part.file_data.file_uri,
                    "error": str(file_error)
                }
        
        return part_dict
