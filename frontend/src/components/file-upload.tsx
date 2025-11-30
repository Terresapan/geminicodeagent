import React, { useState, useRef } from 'react';
import { Upload, File as FileIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { Textarea } from '@/components/ui/textarea';

interface FileUploadProps {
  onUpload: (file: File | null, query: string) => void;
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
    if (file || query.trim()) {
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
    <Card className="p-6 w-full max-w-md mx-auto space-y-4 bg-background/40 backdrop-blur-md border-primary/10 shadow-lg hover:border-primary/30 transition-all duration-300">
      <div
        className={`relative flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-xl transition-all duration-300 ${
          dragActive 
            ? 'border-primary bg-primary/10 scale-[1.02]' 
            : 'border-primary/20 bg-background/50 hover:bg-muted/20 hover:border-primary/40'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
          onChange={handleChange}
          accept=".csv,.xlsx,.xls,.pdf"
          disabled={isLoading}
        />
        
        {!file ? (
          <div className="flex flex-col items-center text-center p-4">
            <div className="p-3 bg-primary/10 rounded-full mb-4 text-primary">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium mb-1 text-foreground">
              Drag & drop or click to upload
            </p>
            <p className="text-xs text-muted-foreground">
              CSV, Excel, or PDF
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center z-10 relative">
            <div className="p-3 bg-primary/10 rounded-full mb-4 text-primary relative">
               <FileIcon className="w-6 h-6" />
               <button 
                 onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation(); // Prevent triggering input
                   clearFile();
                 }}
                 className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 hover:bg-destructive/90 transition-colors z-50"
                 title="Remove file"
               >
                 <X className="w-3 h-3" />
               </button>
            </div>
            <p className="text-sm font-medium mb-2 max-w-[200px] truncate px-2">{file.name}</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block ml-1">
          Analysis Query <span className="text-[10px] font-normal normal-case opacity-70">(Optional if file uploaded)</span>
        </label>
        <Textarea
          placeholder="e.g., Analyze the sales trend for Q4..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
          className="resize-none bg-background/50 border-primary/20 focus-visible:ring-primary/50"
        />
      </div>

      <Button
        className="w-full shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
        onClick={handleSubmit}
        disabled={(!file && !query.trim()) || isLoading}
      >
        {isLoading ? 'Analyzing...' : 'Analyze Data'}
      </Button>
    </Card>
  );
}
