# Data Analysis Agent - Backend

This is the backend service for the Data Analysis Agent, a full-stack application leveraging **Google's Gemini 2.5 Flash** model for advanced data analysis, code execution, and reporting.

## Features

*   **FastAPI Powered:** High-performance, async API.
*   **Gemini 2.5 Integration:** Uses the `google-genai` SDK.
*   **Code Execution:** Sandboxed Python execution for data processing.
*   **Real-time Streaming:** NDJSON streaming for chat and analysis steps.
*   **Cost Estimation:** Built-in token tracking and pricing calculation.
*   **Dual-Service Architecture:** Support for both Free Tier and Paid Tier (with Caching) usage strategies.

## Project Structure

*   `main.py`: Application entry point and API route definitions.
*   `services.py`: Default `AnalysisService` implementation, optimized for Free Tier usage.
*   `services_paid.py`: Advanced `AnalysisService` implementation featuring **Context Caching** and **Heartbeat** mechanisms for Paid Tier efficiency.
*   `pricing.py`: `PricingService` logic for calculating input, output, and storage costs.

## Setup & Installation

1.  **Prerequisites:** Python 3.13+

2.  **Create Virtual Environment:**
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # Windows: .venv\Scripts\activate
    ```

3.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Environment Variables:**
    Create a `.env` file:
    ```env
    GOOGLE_API_KEY=your_api_key_here
    # ADMIN_TOKEN=optional_admin_token
    ```

## Running the Server

Start the development server:

```bash
uvicorn main:app --reload
```

*   **API:** `http://localhost:8000`
*   **Docs:** `http://localhost:8000/docs`

## Switching Services

By default, `main.py` imports from `services.py`. To use the Paid Tier features (Caching):
1.  Modify `main.py`.
2.  Change `from services import AnalysisService` to `from services_paid import AnalysisService`.
