import React from 'react';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ModelFile {
  name: string;
  uri: string;
  mime_type: string;
}

interface ModelFilesTabProps {
  files: ModelFile[];
}

export function ModelFilesTab({ files }: ModelFilesTabProps) {
  if (!files || files.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No model files generated.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[800px] w-full rounded-md border p-4">
      <div className="grid grid-cols-1 gap-4">
        {files.map((file, index) => (
          <Card key={index} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              <div>
                <p className="font-medium">{file.name || `File ${index + 1}`}</p>
                <p className="text-xs text-muted-foreground">{file.mime_type}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const link = document.createElement('a');
                link.href = file.uri;
                link.download = file.name || 'download';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
