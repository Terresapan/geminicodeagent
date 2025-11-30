# Data Analysis Agent - Frontend

The frontend interface for the Data Analysis Agent, built with **Next.js 16**, **Tailwind CSS v4**, and **shadcn/ui**.

## Features

*   **Interactive Chat:** Real-time chat interface with streaming responses.
*   **Multi-Tab View:**
    *   **Analysis:** Text-based insights and thinking process.
    *   **Code:** View generated and executed Python code.
    *   **Charts:** Interactive visualization of data.
    *   **Files:** Access generated reports (PDF) and data files (CSV).
*   **File Upload:** Drag-and-drop file analysis.
*   **Responsive Design:** Modern UI built with Tailwind CSS and Radix UI.

## Setup & Installation

1.  **Prerequisites:** Node.js 18+ and npm.

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configuration:**
    The frontend connects to the backend at `http://localhost:8000` by default.
    Ensure the backend server is running.

## Running the Application

Start the development server:

```bash
npm run dev
```

Access the application at `http://localhost:3000`.

## Build & Deploy

To create a production build:

```bash
npm run build
npm start
```

## key Components

*   `src/app/page.tsx`: Main chat interface.
*   `src/components/ui`: Reusable UI components (shadcn/ui).
*   `src/components/*-tab.tsx`: Specific tab views for Analysis, Code, Charts, etc.