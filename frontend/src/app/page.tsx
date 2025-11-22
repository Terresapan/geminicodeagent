'use client';

import React, { useState } from 'react';
import { FileUpload } from '@/components/file-upload';
import { AnalysisTab } from '@/components/analysis-tab';
import { CodeTab } from '@/components/code-tab';
import { ChartsTab } from '@/components/charts-tab';
import { ModelFilesTab } from '@/components/model-files-tab';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { analyzeFile, AnalysisPart } from '@/lib/api';
import { Card } from '@/components/ui/card';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [analysisParts, setAnalysisParts] = useState<AnalysisPart[]>([]);
  const [activeTab, setActiveTab] = useState('analysis');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const loadingMessages = [
    "Processing your file...",
    "Running AI analysis...",
    "Executing Python code...",
    "Generating insights...",
    "Creating visualizations...",
    "Almost done..."
  ];

  const getLoadingMessage = () => {
    return loadingMessages[loadingMessageIndex % loadingMessages.length];
  };

  // Rotate loading messages
  React.useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingMessageIndex(prev => prev + 1);
      }, 8000); // Change message every 8 seconds
      return () => clearInterval(interval);
    } else {
      setLoadingMessageIndex(0);
    }
  }, [isLoading]);

  const handleUpload = async (file: File, query: string) => {
    setIsLoading(true);
    setAnalysisParts([]);
    try {
      const result = await analyzeFile(file, query, selectedModel, (progressParts) => {
        // Update UI as chunks arrive
        setAnalysisParts(progressParts);
      });
      console.log('Final Analysis Result:', result); // Debug logging
      if (Array.isArray(result)) {
        setAnalysisParts(result);
      } else {
        console.error('Analysis failed:', result);
        alert(`Analysis failed: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.error('Error:', error);
      // Handle error (maybe show a toast)
    } finally {
      setIsLoading(false);
    }
  };

  // Aggregate content from parts
  const analysisContent = analysisParts
    .filter(p => p.text)
    .map(p => p.text)
    .join('\n\n');

  const codeContent = analysisParts
    .filter(p => p.executableCode)
    .map(p => p.executableCode?.code)
    .join('\n\n# Next Block\n\n');

  const chartImages = analysisParts
    .filter(p => p.inlineData && (p.inlineData.mimeType?.startsWith('image/') || p.inlineData.mime_type?.startsWith('image/')))
    .map(p => ({
      mime_type: p.inlineData!.mimeType || p.inlineData!.mime_type!,
      data: p.inlineData!.data.replace(/\s/g, '') // Remove any whitespace/newlines
    }));

  console.log('Chart Images:', chartImages);

  const modelFiles = analysisParts
    .flatMap((p, i) => {
      const files = [];
      
      // Handle inline data files (non-images)
      if (p.inlineData && !(p.inlineData.mimeType?.startsWith('image/') || p.inlineData.mime_type?.startsWith('image/'))) {
        console.log('Found inline data file:', {
          mimeType: p.inlineData.mimeType || p.inlineData.mime_type,
          dataLength: p.inlineData.data?.length,
          dataPreview: p.inlineData.data?.substring(0, 50)
        });
        
        files.push({
          name: `Generated File ${i + 1}`,
          uri: `data:${p.inlineData!.mimeType || p.inlineData!.mime_type};base64,${p.inlineData!.data}`,
          mime_type: p.inlineData!.mimeType || p.inlineData!.mime_type!
        });
      }
      
      // Handle fileData (URI based or base64)
      if (p.fileData) {
        console.log('Found fileData:', p.fileData); // Debug logging
        
        // If data is available (downloaded by backend), use it
        if (p.fileData.data) {
          files.push({
            name: p.fileData.name || `Downloaded File ${i + 1}`,
            uri: `data:${p.fileData.mimeType || 'application/octet-stream'};base64,${p.fileData.data}`,
            mime_type: p.fileData.mimeType || 'application/octet-stream'
          });
        } else if (p.fileData.fileUri) {
          // Fallback to URI if no data (though this likely won't work)
          files.push({
            name: `Remote File ${i + 1}`,
            uri: p.fileData.fileUri,
            mime_type: p.fileData.mimeType || 'application/octet-stream'
          });
        }
      }
      
      return files;
    });

  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Data Analysis Agent
          </h1>
          <p className="text-muted-foreground">Upload your financial data and let AI analyze it</p>
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
                      <span className="text-xs text-muted-foreground">Fast responses</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gemini-2.5-pro">
                    <div className="flex flex-col">
                      <span className="font-medium">Gemini 2.5 Pro</span>
                      <span className="text-xs text-muted-foreground">Advanced analysis</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </Card>

            <FileUpload onUpload={handleUpload} isLoading={isLoading} />
            
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
                <Tabs defaultValue="analysis" value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="analysis">Analysis</TabsTrigger>
                    <TabsTrigger value="code">Code</TabsTrigger>
                    <TabsTrigger value="charts">Charts ({chartImages.length})</TabsTrigger>
                    <TabsTrigger value="files">Files ({modelFiles.length})</TabsTrigger>
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
                  <p className="text-sm">Upload a file to see the results here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
