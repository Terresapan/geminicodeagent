import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AnalysisTabProps {
  content: string;
}

export function AnalysisTab({ content }: AnalysisTabProps) {
  return (
    <ScrollArea className="h-[800px] w-full rounded-md border p-4">
      <div className="prose dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </ScrollArea>
  );
}
