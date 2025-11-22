import React, { useState, useRef } from 'react';
import { Upload, File as FileIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { Textarea } from '@/components/ui/textarea';

interface FileUploadProps {
  onUpload: (file: File, query: string) => void;
  isLoading: boolean;
}

export function FileUpload({ onUpload, isLoading }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (file) {
      onUpload(file, query);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <Card className="p-6 w-full max-w-md mx-auto space-y-4">
      <div
        className={`relative flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg transition-colors ${
          dragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleChange}
          accept=".csv,.xlsx,.xls,.pdf"
          disabled={isLoading}
        />
        
        {!file ? (
          <div className="flex flex-col items-center text-center p-4">
            <Upload className="w-10 h-10 mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              Drag & drop or click to upload
            </p>
            <p className="text-xs text-muted-foreground">
              CSV, Excel, or PDF
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center z-10">
            <FileIcon className="w-10 h-10 mb-4 text-primary" />
            <p className="text-sm font-medium mb-2">{file.name}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                clearFile();
              }}
              className="text-destructive hover:text-destructive"
            >
              Remove
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium block mb-3">Analysis Query (Optional)</label>
        <Textarea
          placeholder="e.g., Analyze the sales trend for Q4..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
          className="resize-none"
        />
      </div>

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={!file || isLoading}
      >
        {isLoading ? 'Analyzing...' : 'Analyze Data'}
      </Button>
    </Card>
  );
}
