"use client";

import React, { useState, useRef } from "react";
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
import { createChat, sendChatMessage, deleteChat, AnalysisPart } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Send, Loader2, Trash2, DollarSign } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
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
  React.useEffect(() => {
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
  React.useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

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
    
    if (!confirm("Are you sure you want to delete this chat session? This action cannot be undone.")) {
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
      !(
        p.inlineData.mimeType?.startsWith("image/") ||
        p.inlineData.mime_type?.startsWith("image/")
      )
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

  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold mb-2 bg-linear-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Data Analysis Agent
          </h1>
          <p className="text-muted-foreground">
            Upload your financial data and let AI analyze it
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6">
            {/* Model Selection Card */}
            <Card className="p-4 bg-muted/50">
              <h3 className="font-semibold mb-2">Select Model</h3>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full">
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
              <Card className="p-4 bg-muted/50 flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Chat History</h3>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground ml-4"
                          : "bg-muted text-muted-foreground mr-4"
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
                    className="min-h-20 resize-none"
                    disabled={isLoading}
                  />
                  <Button
                    className="w-full"
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
              <Card className="p-4 bg-muted/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Estimated Cost
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Input Tokens:</span>
                    <span>{costData.input_tokens?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Output Tokens:</span>
                    <span>{costData.output_tokens?.toLocaleString() || 0}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                    <span>Total Cost:</span>
                    <span>${(costData.total_cost || 0).toFixed(6)}</span>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-4 bg-muted/50">
              <h3 className="font-semibold mb-1">Capabilities</h3>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>Financial Statement Analysis</li>
                <li>Trend Identification</li>
                <li>Anomaly Detection</li>
                <li>Chart Generation</li>
                <li>Python Code Execution</li>
              </ul>
            </Card>
          </div>

          <div className="lg:col-span-3">
            {analysisParts.length > 0 ? (
              <Card className="p-6">
                <Tabs
                  defaultValue="analysis"
                  value={activeTab}
                  onValueChange={setActiveTab}
                >
                  <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="analysis">Analysis</TabsTrigger>
                    <TabsTrigger value="code">Code</TabsTrigger>
                    <TabsTrigger value="charts">
                      Charts ({chartImages.length})
                    </TabsTrigger>
                    <TabsTrigger value="files">
                      Files ({modelFiles.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="analysis" className="mt-0">
                    <AnalysisTab content={analysisContent} />
                  </TabsContent>

                  <TabsContent value="code" className="mt-0">
                    <CodeTab code={codeContent} />
                  </TabsContent>

                  <TabsContent value="charts" className="mt-0">
                    <ChartsTab images={chartImages} />
                  </TabsContent>

                  <TabsContent value="files" className="mt-0">
                    <ModelFilesTab files={modelFiles} />
                  </TabsContent>
                </Tabs>
              </Card>
            ) : isLoading ? (
              <div className="h-full flex items-center justify-center p-12 border-2 border-dashed rounded-lg bg-muted/10 animate-pulse">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium">Analyzing...</p>
                    <p className="text-sm text-muted-foreground animate-pulse">
                      {getLoadingMessage()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-12 border-2 border-dashed rounded-lg text-muted-foreground bg-muted/10">
                <div className="text-center">
                  <p className="text-lg font-medium">Ready to Analyze</p>
                  <p className="text-sm">
                    Upload a file to see the results here.
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
