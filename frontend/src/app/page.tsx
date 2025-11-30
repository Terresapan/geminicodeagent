"use client";

import React, { useState, useRef, useEffect } from "react";
import { FileUpload } from "@/components/file-upload";
import { AnalysisTab } from "@/components/analysis-tab";
import { CodeTab } from "@/components/code-tab";
import { ChartsTab } from "@/components/charts-tab";
import { ModelFilesTab } from "@/components/model-files-tab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createChat,
  sendChatMessage,
  deleteChat,
  AnalysisPart,
  verifyAuth,
  setAuthPassword,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Send, Loader2, Trash2, DollarSign, Lock } from "lucide-react";
import Image from "next/image";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [analysisParts, setAnalysisParts] = useState<AnalysisPart[]>([]);
  const [activeTab, setActiveTab] = useState("analysis");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadingMessages = [
    "Processing your file...",
    "Running AI analysis...",
    "Executing Python code...",
    "Generating insights...",
    "Creating visualizations...",
    "Almost done...",
  ];

  const getLoadingMessage = () => {
    return loadingMessages[loadingMessageIndex % loadingMessages.length];
  };

  // Rotate loading messages
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingMessageIndex((prev) => prev + 1);
      }, 8000); // Change message every 8 seconds
      return () => clearInterval(interval);
    } else {
      setLoadingMessageIndex(0);
    }
  }, [isLoading]);

  // Scroll to bottom of chat history
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setAuthError("");

    try {
      const isValid = await verifyAuth(passwordInput);
      if (isValid) {
        setAuthPassword(passwordInput);
        setIsAuthenticated(true);
      } else {
        setAuthError("Invalid password. Please try again.");
      }
    } catch (error) {
      console.error("Authentication error:", error);
      setAuthError("Authentication failed. Check backend connection.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUpload = async (file: File | null, query: string) => {
    setIsLoading(true);
    setAnalysisParts([]);
    setChatHistory([{ role: "user", content: query }]);

    try {
      // 1. Create Chat Session
      const { chat_id } = await createChat(file, selectedModel);
      setChatId(chat_id);

      // 2. Send Initial Message
      const result = await sendChatMessage(chat_id, query, (progressParts) => {
        // Update UI as chunks arrive
        setAnalysisParts(progressParts);
      });

      console.log("Final Analysis Result:", result);
      if (Array.isArray(result)) {
        setAnalysisParts(result);
        // Add assistant response to history (summarized or just a marker)
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: "Analysis complete. See results tab." },
        ]);
      } else {
        console.error("Analysis failed:", result);
        alert(`Analysis failed: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatId || !chatInput.trim() || isLoading) return;

    const message = chatInput.trim();
    setChatInput("");
    setIsLoading(true);
    setChatHistory((prev) => [...prev, { role: "user", content: message }]);

    try {
      const result = await sendChatMessage(chatId, message, (progressParts) => {
        setAnalysisParts(progressParts);
      });

      if (Array.isArray(result)) {
        setAnalysisParts(result);
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: "Analysis updated. See results tab." },
        ]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteChat = async () => {
    if (!chatId) return;

    if (
      !confirm(
        "Are you sure you want to delete this chat session? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteChat(chatId);
      // Reset state
      setChatId(null);
      setChatHistory([]);
      setAnalysisParts([]);
      setActiveTab("analysis");
      setChatInput("");
    } catch (error) {
      console.error("Error deleting chat:", error);
      alert("Failed to delete chat session");
    } finally {
      setIsDeleting(false);
    }
  };

  // Aggregate content from parts
  const analysisContent = analysisParts
    .filter((p) => p.text)
    .map((p) => p.text)
    .join("\n\n");

  const codeContent = analysisParts
    .filter((p) => p.executableCode)
    .map((p) => p.executableCode?.code)
    .join("\n\n# Next Block\n\n");

  // Extract cost data
  const costData = React.useMemo(() => {
    for (let i = analysisParts.length - 1; i >= 0; i--) {
      if (analysisParts[i].costData) {
        return analysisParts[i].costData;
      }
    }
    return null;
  }, [analysisParts]);

  // Deduplicate charts based on data content
  const uniqueCharts = new Map<string, { mime_type: string; data: string }>();

  analysisParts.forEach((p) => {
    if (
      p.inlineData &&
      (p.inlineData.mimeType?.startsWith("image/") ||
        p.inlineData.mime_type?.startsWith("image/"))
    ) {
      const data = p.inlineData.data.replace(/\s/g, "");
      const mimeType = p.inlineData.mimeType || p.inlineData.mime_type!;

      // Only add if we haven't seen this image data before
      if (!uniqueCharts.has(data)) {
        uniqueCharts.set(data, { mime_type: mimeType, data });
      }
    }
  });

  const chartImages = Array.from(uniqueCharts.values());

  // Deduplicate files
  interface FileData {
    name: string;
    uri: string;
    mime_type: string;
  }
  const uniqueFiles = new Map<string, FileData>();

  analysisParts.forEach((p, i) => {
    // Handle inline data files (non-images)
    if (
      p.inlineData &&
      (p.inlineData.mimeType?.startsWith("image/") ||
        p.inlineData.mime_type?.startsWith("image/"))
    ) {
      const data = p.inlineData.data;
      const mimeType = p.inlineData.mimeType || p.inlineData.mime_type!;
      const key = `inline-${data.substring(0, 100)}`; // Use start of data as key

      if (!uniqueFiles.has(key)) {
        uniqueFiles.set(key, {
          name: `Generated File ${uniqueFiles.size + 1}`,
          uri: `data:${mimeType};base64,${data}`,
          mime_type: mimeType,
        });
      }
    }

    // Handle fileData (URI based or base64)
    if (p.fileData) {
      const key =
        p.fileData.fileUri || p.fileData.data?.substring(0, 100) || `file-${i}`;

      if (!uniqueFiles.has(key)) {
        if (p.fileData.data) {
          uniqueFiles.set(key, {
            name: p.fileData.name || `Downloaded File ${uniqueFiles.size + 1}`,
            uri: `data:${
              p.fileData.mimeType || "application/octet-stream"
            };base64,${p.fileData.data}`,
            mime_type: p.fileData.mimeType || "application/octet-stream",
          });
        } else if (p.fileData.fileUri) {
          uniqueFiles.set(key, {
            name: `Remote File ${uniqueFiles.size + 1}`,
            uri: p.fileData.fileUri,
            mime_type: p.fileData.mimeType || "application/octet-stream",
          });
        }
      }
    }
  });

  const modelFiles = Array.from(uniqueFiles.values());

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
        <Image
          src="/main.png"
          alt="App Preview"
          fill
          className="object-cover opacity-80 blur-sm"
          priority
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-indigo-900/10 rounded-full blur-3xl pointer-events-none" />

        <Card className="w-full max-w-md p-8 bg-background/40 backdrop-blur-md border-primary/10 shadow-xl relative z-10">
          <div className="text-center mb-8 space-y-2">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-fuchsia-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
              Admin Access Required
            </h1>
            <p className="text-muted-foreground">
              Please enter the system admin token to continue.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Admin Token</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter admin token..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="bg-background/50"
              />
            </div>

            {authError && (
              <p className="text-sm text-destructive text-center font-medium">
                {authError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isVerifying || !passwordInput}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Unlock Access"
              )}
            </Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-8 relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-purple-900/20 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-indigo-900/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-extrabold mb-2 bg-linear-to-r from-fuchsia-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent tracking-tight drop-shadow-sm">
            Data Analysis Agent
          </h1>
          <p className="text-muted-foreground text-lg">
            Upload your financial data and let AI analyze it
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6">
            {/* Model Selection Card */}
            <Card className="p-4 bg-background/40 backdrop-blur-md border-primary/10 shadow-lg hover:border-primary/30 transition-all duration-300">
              <h3 className="font-semibold mb-2">Select Model</h3>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full bg-background/50 border-primary/20 focus:ring-primary/50">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash">
                    <div className="flex flex-col">
                      <span className="font-medium">Gemini 2.5 Flash</span>
                      <span className="text-xs text-muted-foreground">
                        Fast responses
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gemini-2.5-pro">
                    <div className="flex flex-col">
                      <span className="font-medium">Gemini 2.5 Pro</span>
                      <span className="text-xs text-muted-foreground">
                        Advanced analysis
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </Card>

            {!chatId ? (
              <FileUpload onUpload={handleUpload} isLoading={isLoading} />
            ) : (
              <Card className="p-4 bg-background/40 backdrop-blur-md border-primary/10 shadow-lg hover:border-primary/30 transition-all duration-300 flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Chat History</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={handleDeleteChat}
                    disabled={isLoading || isDeleting}
                    title="Delete Chat"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span className="sr-only">Delete Chat</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg text-sm shadow-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground ml-4"
                          : "bg-muted/80 text-muted-foreground mr-4 border border-border/50"
                      }`}
                    >
                      <p className="font-semibold text-xs mb-1 opacity-70">
                        {msg.role === "user" ? "You" : "Assistant"}
                      </p>
                      {msg.content}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="space-y-2">
                  <Textarea
                    placeholder="Ask a follow-up question..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-20 resize-none bg-background/50 border-primary/20 focus-visible:ring-primary/50"
                    disabled={isLoading}
                  />
                  <Button
                    className="w-full shadow-md shadow-primary/20"
                    onClick={handleSendMessage}
                    disabled={isLoading || !chatInput.trim()}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send
                  </Button>
                </div>
              </Card>
            )}

            {costData && (
              <Card className="p-4 bg-background/40 backdrop-blur-md border-primary/10 shadow-lg hover:border-primary/30 transition-all duration-300">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-primary">
                  <DollarSign className="w-4 h-4" />
                  Estimated Cost
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Input Tokens:</span>
                    <span className="font-mono">
                      {costData.input_tokens?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Output Tokens:
                    </span>
                    <span className="font-mono">
                      {costData.output_tokens?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="border-t border-border/50 pt-2 mt-2 flex justify-between font-medium">
                    <span>Total Cost:</span>
                    <span className="font-mono text-primary">
                      ${(costData.total_cost || 0).toFixed(6)}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-4 bg-background/40 backdrop-blur-md border-primary/10 shadow-lg hover:border-primary/30 transition-all duration-300">
              <h3 className="font-semibold mb-1">Capabilities</h3>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside marker:text-primary">
                <li>Financial Statement Analysis</li>
                <li>Trend Identification</li>
                <li>Anomaly Detection</li>
                <li>Chart & PDF File Generation </li>
                <li>Python Code Execution</li>
              </ul>
            </Card>
          </div>

          <div className="lg:col-span-3">
            {analysisParts.length > 0 ? (
              <Card className="p-6 bg-background/60 backdrop-blur-xl border-primary/10 shadow-xl h-full">
                <Tabs
                  defaultValue="analysis"
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="h-full flex flex-col"
                >
                  <TabsList className="grid w-full grid-cols-4 mb-6 bg-muted/50 p-1">
                    <TabsTrigger
                      value="analysis"
                      className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      Analysis
                    </TabsTrigger>
                    <TabsTrigger
                      value="code"
                      className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      Code
                    </TabsTrigger>
                    <TabsTrigger
                      value="charts"
                      className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      Charts ({chartImages.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="files"
                      className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      Files ({modelFiles.length})
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-hidden">
                    <TabsContent
                      value="analysis"
                      className="mt-0 h-full overflow-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20"
                    >
                      <AnalysisTab content={analysisContent} />
                    </TabsContent>

                    <TabsContent
                      value="code"
                      className="mt-0 h-full overflow-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20"
                    >
                      <CodeTab code={codeContent} />
                    </TabsContent>

                    <TabsContent
                      value="charts"
                      className="mt-0 h-full overflow-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20"
                    >
                      <ChartsTab images={chartImages} />
                    </TabsContent>

                    <TabsContent
                      value="files"
                      className="mt-0 h-full overflow-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20"
                    >
                      <ModelFilesTab files={modelFiles} />
                    </TabsContent>
                  </div>
                </Tabs>
              </Card>
            ) : isLoading ? (
              <div className="h-full flex items-center justify-center p-12 border-2 border-dashed border-primary/20 rounded-xl bg-background/40 backdrop-blur-sm animate-pulse">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-primary/20"></div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-medium bg-linear-to-r from-fuchsia-500 to-indigo-500 bg-clip-text text-transparent">
                      Analyzing...
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getLoadingMessage()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-12 border-2 border-dashed border-muted-foreground/20 rounded-xl text-muted-foreground bg-background/40 backdrop-blur-sm hover:border-primary/30 transition-colors duration-300">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                    <Send className="w-8 h-8 ml-1" />
                  </div>
                  <p className="text-xl font-medium text-foreground">
                    Ready to Analyze
                  </p>
                  <p className="text-sm max-w-sm mx-auto">
                    Upload a financial document (PDF, CSV, Excel) to the left to
                    generate insights, code, and visualizations.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
