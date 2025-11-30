# Data Analysis Agent

This project is a full-stack application featuring a **FastAPI** backend and a **Next.js** frontend. It serves as a Data Analysis Agent, leveraging **Google's Gemini 2.5 Flash** model to analyze uploaded files, execute Python code, and generate reports.

## Project Structure

*   `backend/`: Python/FastAPI application handling API requests, chat sessions, and AI integration.
*   `frontend/`: Next.js (TypeScript) application providing the interactive chat interface.

## Backend (`/backend`)

The backend is built with Python 3.13+ and FastAPI. It uses the `google-genai` SDK to interact with Gemini models, enabling advanced features like **Code Execution** and **Thinking Mode**.

### Key Features
*   **Gemini 2.5 Flash:** Utilizes the latest efficient model for analysis.
*   **Code Execution:** The AI can write and execute Python code in a sandboxed environment to perform data analysis and generate visualizations.
*   **PDF Reporting:** The AI creates comprehensive PDF reports using the `reportlab` library (within the sandbox).
*   **Stateful Chat:** Supports continuous conversation threads with context retention.
*   **Streaming:** Responses (text, code, files) are streamed in real-time using NDJSON.

### Setup & Installation

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```

2.  Create and activate a virtual environment (recommended):
    ```bash
    # Using standard python venv
    python -m venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    
    # OR using uv (if installed)
    uv venv
    source .venv/bin/activate
    ```

3.  Install dependencies:
    ```bash
    # Using pip
    pip install -r requirements.txt
    
    # OR using uv
    uv sync
    ```

4.  **Environment Variables:**
    *   Create a `.env` file in the `backend/` directory.
    *   Add your Google API key:
        ```env
        GOOGLE_API_KEY=your_api_key_here
        ```

### Running the Server

Start the development server using Uvicorn:

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.
*   Swagger UI: `http://localhost:8000/docs`
*   Health Check: `http://localhost:8000/`

## Frontend (`/frontend`)

The frontend is a Next.js 16 application using the App Router, TypeScript, and Tailwind CSS v4. It provides a rich interface for interacting with the AI.

### Setup & Installation

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the Application

Start the development server:

```bash
npm run dev
```

The application will be accessible at `http://localhost:3000`.

### Building for Production

```bash
npm run build
npm start
```

## Conventions & Architecture

*   **Styling:** The frontend uses Tailwind CSS (v4) and **shadcn/ui** (built on Radix UI primitives).
*   **State/Async:** The frontend uses `axios` for API requests and React state to manage the chat stream.
*   **UI Structure:**
    *   The interface is divided into tabs for organized viewing: **Analysis** (text), **Code** (executed Python), **Charts** (visualizations), and **Files** (generated PDFs/CSVs).
*   **Backend Architecture:**
    *   `main.py`: Defines API routes (`/chat/create`, `/chat/{id}/message`, `/analyze`) and CORS settings.
    *   `services.py`: Core business logic. Manages `AnalysisService` which handles file uploads to Google GenAI, chat session state (`_chat_sessions`), and response serialization.
    *   **Streaming:** All AI interactions use `StreamingResponse` to deliver multi-part content (text, executables, files) as it's generated.

## Key Dependencies

*   **Backend:** `fastapi`, `uvicorn`, `google-genai`, `python-multipart`, `python-dotenv`
*   **Frontend:** `next`, `react`, `tailwindcss`, `lucide-react`, `axios`, `@radix-ui/*` (shadcn/ui)
