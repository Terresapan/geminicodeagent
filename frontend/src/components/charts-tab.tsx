import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

interface ChartImage {
  mime_type: string;
  data: string;
}

interface ChartsTabProps {
  images: ChartImage[];
}

export function ChartsTab({ images }: ChartsTabProps) {
  if (!images || images.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No charts generated.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[800px] w-full rounded-md border p-4">
      <div className="grid grid-cols-1 gap-6">
        {images.map((img, index) => (
          <Card key={index} className="overflow-hidden p-4 bg-card">
            <img
              src={`data:${img.mime_type};base64,${img.data}`}
              alt={`Chart ${index + 1}`}
              className="w-full h-auto rounded-md"
              onError={(e) => {
                console.error('Error loading image:', e);
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="text-xs text-muted-foreground mt-2">
              {img.mime_type} - {img.data.substring(0, 20)}...
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
