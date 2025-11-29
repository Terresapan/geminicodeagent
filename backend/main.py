"""
FastAPI application for Data Analysis Agent.
Handles API routes and delegates business logic to services.
"""

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "Data Analysis Agent Backend is running"}


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
        return {"error": str(e)}


@app.post("/pdf-report")
async def generate_pdf_report(report_data: dict):
    """
    Generate a PDF report from analysis data.
    
    Args:
        report_data: The analysis data to convert to PDF
        
    Returns:
        PDF file or error message
    """
    # TODO: Implement PDF generation
    return {"message": "PDF generation not yet implemented"}
