import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodeTabProps {
  code: string;
  language?: string;
}

export function CodeTab({ code, language = 'python' }: CodeTabProps) {
  return (
    <ScrollArea className="h-[800px] w-full rounded-md border bg-[#1e1e1e]">
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{ margin: 0, padding: '1.5rem', background: 'transparent' }}
        showLineNumbers={true}
      >
        {code}
      </SyntaxHighlighter>
    </ScrollArea>
  );
}
