"""
FastAPI application for Data Analysis Agent.
Handles API routes and delegates business logic to services.
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi import Request
from fastapi.security import APIKeyHeader
import os
from dotenv import load_dotenv

from services import AnalysisService

# Load environment variables
load_dotenv()

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")
api_key_header = APIKeyHeader(name="X-Admin-Token", auto_error=False)

# Initialize FastAPI app
app = FastAPI(title="Data Analysis Agent API")

# Get allowed origins from env, defaulting to local development URLs
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

# Always allow local development URLs (fixes the localhost vs 127.0.0.1 issue)
if not allowed_origins_env or "localhost" in allowed_origins_env:
    origins.extend([
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ])

print(f"Server starting with ALLOWED_ORIGINS: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Must be specific URLs, never ["*"] if credentials=True
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
analysis_service = AnalysisService(api_key=os.environ.get("GEMINI_API_KEY"))

async def verify_token(token: str = Depends(api_key_header)):
    if not ADMIN_TOKEN:
        # If no token set in env, allow access (dev mode)
        return True
    
    if token != ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token"
        )
    return True

# ==================== Health Check ====================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "Data Analysis Agent Backend is running"}

@app.post("/verify-auth")
async def verify_auth_endpoint(authorized: bool = Depends(verify_token)):
    """Verify authentication token."""
    return {"status": "authenticated"}

# ==================== File Analysis ====================

@app.post("/analyze", dependencies=[Depends(verify_token)])
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

@app.post("/chat/create", dependencies=[Depends(verify_token)])
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


@app.post("/chat/{chat_id}/message", dependencies=[Depends(verify_token)])
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


@app.delete("/chat/{chat_id}", dependencies=[Depends(verify_token)])
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