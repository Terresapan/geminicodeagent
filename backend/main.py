"""
FastAPI application for Data Analysis Agent.
Handles API routes and delegates business logic to services.
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi import Request
import os
from dotenv import load_dotenv

from services import AnalysisService

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Data Analysis Agent API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
analysis_service = AnalysisService(api_key=os.environ.get("GOOGLE_API_KEY"))

# ==================== Health Check ====================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "Data Analysis Agent Backend is running"}

# ==================== File Analysis ====================

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(None),
    query: str = Form(...),
    model: str = Form("gemini-2.5-flash")
):
    """
    Analyze a file using AI with streaming response.
    
    Args:
        file: The uploaded file to analyze (optional)
        query: User's analysis query
        model: The AI model to use (default: gemini-2.5-flash)
        
    Returns:
        StreamingResponse with analysis results in NDJSON format
    """
    try:
        # Read file content if provided
        file_content = None
        filename = None
        content_type = None
        
        if file:
            file_content = await file.read()
            filename = file.filename
            content_type = file.content_type
        
        # Delegate to analysis service
        return StreamingResponse(
            analysis_service.analyze_file_stream(
                file_content=file_content,
                filename=filename,
                content_type=content_type,
                query=query,
                model=model
            ),
            media_type="application/x-ndjson"
        )
    except Exception as e:
        print(f"Error during analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Chat Operations ====================

@app.post("/chat/create")
async def create_chat(
    file: UploadFile = File(None),
    model: str = Form("gemini-2.5-flash")
):
    """
    Create a new chat session with optional file attachment.
    
    Args:
        file: The uploaded file to attach to chat (optional)
        model: The AI model to use (default: gemini-2.5-flash)
        
    Returns:
        JSON response with chat session ID
    """
    try:
        # Read file content if provided
        file_content = None
        filename = None
        content_type = None
        
        if file:
            file_content = await file.read()
            filename = file.filename
            content_type = file.content_type
        
        # Create chat session
        chat_id = await analysis_service.create_chat(
            file_content=file_content,
            filename=filename,
            content_type=content_type,
            model=model
        )
        
        return {"chat_id": chat_id, "model": model}
    except Exception as e:
        print(f"Error creating chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/{chat_id}/message")
async def send_chat_message(
    chat_id: str,
    request: Request
):
    """
    Send a message to an existing chat session.
    
    Args:
        chat_id: The chat session ID
        request: HTTP request with JSON body containing 'message' field
        
    Returns:
        StreamingResponse with chat response in NDJSON format
    """
    try:
        message_data = await request.json()
        message = message_data.get("message", "")
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        # Stream the response
        return StreamingResponse(
            analysis_service.send_message_to_chat(
                chat_id=chat_id,
                message=message,
                stream=True
            ),
            media_type="application/x-ndjson"
        )
    except Exception as e:
        print(f"Error sending message: {e}")
        # If it's already an HTTPException, re-raise it
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/chat/{chat_id}")
async def delete_chat(chat_id: str):
    """
    Delete a chat session.
    
    Args:
        chat_id: The chat session ID to delete
        
    Returns:
        Success message or error
    """
    try:
        analysis_service.delete_chat(chat_id)
        return {"message": f"Chat {chat_id} deleted successfully"}
    except Exception as e:
        print(f"Error deleting chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))
