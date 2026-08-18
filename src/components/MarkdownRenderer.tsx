import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split by line breaks to render paragraphs, lists, and headers
  const lines = content.split('\n');

  return (
    <div className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-100">
      {lines.map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={index} className="h-1" />;
        }

        // Heading 3 or ###
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={index} className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mt-3 mb-1">
              {renderFormattedText(trimmed.replace(/^###\s+/, ''))}
            </h4>
          );
        }

        // Heading 2 or ##
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={index} className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white mt-4 mb-1">
              {renderFormattedText(trimmed.replace(/^##\s+/, ''))}
            </h3>
          );
        }

        // Heading 1 or #
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={index} className="font-black text-lg sm:text-xl text-slate-900 dark:text-white mt-4 mb-2">
              {renderFormattedText(trimmed.replace(/^#\s+/, ''))}
            </h2>
          );
        }

        // Bullet point - or *
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={index} className="flex items-start gap-2 pl-2">
              <span className="text-emerald-500 font-bold mt-1 text-xs">•</span>
              <span className="flex-1">{renderFormattedText(trimmed.substring(2))}</span>
            </div>
          );
        }

        // Numbered list (e.g. 1. 2.)
        const matchNumbered = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (matchNumbered) {
          return (
            <div key={index} className="flex items-start gap-2 pl-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">{matchNumbered[1]}.</span>
              <span className="flex-1">{renderFormattedText(matchNumbered[2])}</span>
            </div>
          );
        }

        // Blockquote >
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={index} className="border-l-4 border-emerald-500 pl-3 py-1 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-r-lg text-slate-700 dark:text-slate-300 italic my-2 text-xs sm:text-sm">
              {renderFormattedText(trimmed.substring(2))}
            </blockquote>
          );
        }

        // Normal paragraph
        return (
          <p key={index} className="my-1">
            {renderFormattedText(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

// Helper function to format bold (**bold**), italic (*italic*), and code (`code`)
function renderFormattedText(text: string): React.ReactNode {
  // Regex to split by bold (**text**), inline code (`text`), or italic (*text*)
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}
