// This allows Vercel to inject the production URL, but falls back to localhost for you.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Type Definitions ---
export interface AnalysisPart {
  text?: string;
  executableCode?: {
    code: string;
    language: string;
  };
  codeExecutionResult?: {
    outcome: string;
    output: string;
  };
  inlineData?: {
    mimeType?: string;
    mime_type?: string;
    data: string;
  };
  fileData?: {
    fileUri?: string;
    mimeType?: string;
    name?: string;
    data?: string;
  };
  costData?: any;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  model: string;
  created_at: Date;
  messages: ChatMessage[];
}

let authPassword = "";

export function setAuthPassword(password: string) {
  authPassword = password;
}

function getHeaders(base: Record<string, string> = {}): Record<string, string> {
  const headers = { ...base };
  if (authPassword) {
    headers["X-Admin-Token"] = authPassword;
  }
  return headers;
}

// --- Authentication Functions ---
export async function verifyAuth(password: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/verify-auth`, {
      method: "POST",
      headers: {
        "X-Admin-Token": password,
      },
    });
    return response.ok;
  } catch (e) {
    console.error("Auth verification failed:", e);
    return false;
  }
}

export async function analyzeFile(
  file: File | null,
  query: string,
  model: string,
  onProgress: (parts: AnalysisPart[]) => void
): Promise<AnalysisPart[]> {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  formData.append("query", query);
  formData.append("model", model);

  try {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      headers: getHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    return await readStreamResponse(response.body, onProgress);
  } catch (error) {
    console.error("Error in analyzeFile:", error);
    throw error;
  }
}

async function readStreamResponse(
  stream: ReadableStream<Uint8Array>,
  onProgress: (parts: AnalysisPart[]) => void
): Promise<AnalysisPart[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastParts: AnalysisPart[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep the last incomplete line

    for (const line of lines) {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line);
          if (Array.isArray(parsed)) {
            lastParts = parsed;
            onProgress(lastParts);
          }
        } catch (e) {
          console.error("Error parsing JSON chunk:", e);
        }
      }
    }
  }

  // Handle any remaining buffer
  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer);
      if (Array.isArray(parsed)) {
        lastParts = parsed;
        onProgress(lastParts);
      }
    } catch (e) {
      console.error("Error parsing final JSON chunk:", e);
    }
  }

  return lastParts;
}

export async function createChat(
  file: File | null = null,
  model: string = "gemini-2.5-flash"
): Promise<{ chat_id: string; model: string }> {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  formData.append("model", model);

  try {
    const response = await fetch(`${API_BASE_URL}/chat/create`, {
      method: "POST",
      headers: getHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Chat creation failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating chat:", error);
    throw error;
  }
}

export async function sendChatMessage(
  chatId: string,
  message: string,
  onProgress: (parts: AnalysisPart[]) => void
): Promise<AnalysisPart[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/${chatId}/message`, {
      method: "POST",
      headers: getHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`Message sending failed: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastParts: AnalysisPart[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep the last incomplete line

      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            if (Array.isArray(parsed)) {
              lastParts = parsed;
              onProgress(lastParts);
            }
          } catch (e) {
            console.error("Error parsing JSON chunk:", e);
          }
        }
      }
    }

    // Handle any remaining buffer
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        if (Array.isArray(parsed)) {
          lastParts = parsed;
          onProgress(lastParts);
        }
      } catch (e) {
        console.error("Error parsing final JSON chunk:", e);
      }
    }

    return lastParts;
  } catch (error) {
    console.error("Error sending chat message:", error);
    throw error;
  }
}

export async function deleteChat(chatId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/${chatId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Chat deletion failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error deleting chat:", error);
    throw error;
  }
}
