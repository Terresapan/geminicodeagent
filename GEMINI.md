# Data Analysis Agent

This project is a full-stack application featuring a **FastAPI** backend and a **Next.js** frontend. It serves as a Data Analysis Agent, leveraging Google's Generative AI models to analyze uploaded files.

## Project Structure

*   `backend/`: Python/FastAPI application handling API requests and AI integration.
*   `frontend/`: Next.js (TypeScript) application providing the user interface.

## Backend (`/backend`)

The backend is built with Python 3.13+ and FastAPI. It utilizes `google-genai` for AI capabilities.

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

The frontend is a Next.js 16 application using the App Router, TypeScript, and Tailwind CSS v4.

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

*   **Styling:** The frontend uses Tailwind CSS (v4) and Radix UI primitives (via `components/ui`).
*   **State/Async:** The frontend uses `axios` for API requests.
*   **Backend Architecture:**
    *   `main.py`: Entry point, defines API routes and middleware.
    *   `services.py`: Contains business logic (e.g., `AnalysisService`).
    *   **Streaming:** The `/analyze` endpoint returns a `StreamingResponse` (NDJSON format) to stream AI responses to the client.
*   **CORS:** The backend is configured to allow requests from `http://localhost:3000`.

## Key Dependencies

*   **Backend:** `fastapi`, `uvicorn`, `google-genai`, `python-dotenv`
*   **Frontend:** `next`, `react`, `tailwindcss`, `lucide-react`, `axios`, `@radix-ui/*`
