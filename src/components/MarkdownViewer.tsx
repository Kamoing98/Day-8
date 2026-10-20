import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownViewerProps {
  content: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  let codeBlockIndex = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced Code Block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      const codeText = codeLines.join('\n');
      const currentIndex = codeBlockIndex++;

      elements.push(
        <div key={key++} className="my-6 rounded-xl overflow-hidden border border-slate-800 shadow-sm bg-slate-900 text-slate-100">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-800/90 border-b border-slate-700/60 text-xs text-slate-400 font-mono">
            <span>{lang || 'text'}</span>
            <button
              onClick={() => copyToClipboard(codeText, currentIndex)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              {copiedIndex === currentIndex ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-4 text-xs sm:text-sm font-mono overflow-x-auto leading-relaxed text-slate-200">
            <code>{codeText}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={key++} className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-8 mb-4 border-b border-slate-200 pb-3">
          {renderInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-8 mb-4 flex items-center gap-2">
          <span className="w-2 h-6 bg-indigo-600 rounded-full inline-block"></span>
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="text-lg sm:text-xl font-bold text-slate-800 mt-6 mb-3">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={key++} className="text-base font-bold text-indigo-900 mt-5 mb-2 font-mono">
          {renderInline(line.slice(5))}
        </h4>
      );
      i++;
      continue;
    }

    // Horizontal Rule
    if (line.trim() === '---') {
      elements.push(<hr key={key++} className="my-8 border-slate-200" />);
      i++;
      continue;
    }

    // Markdown Table
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0].split('|').slice(1, -1).map(c => c.trim());
        const bodyRows = tableLines.slice(2).map(r => r.split('|').slice(1, -1).map(c => c.trim()));

        elements.push(
          <div key={key++} className="my-6 overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold">
                <tr>
                  {headerRow.map((cell, idx) => (
                    <th key={idx} className="px-4 py-3 border-b border-slate-200">
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-indigo-50/40 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-2.5 whitespace-normal">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Unordered List
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-1.5 my-3 text-slate-700 leading-relaxed text-sm">
          {listItems.map((item, idx) => (
            <li key={idx} className="pl-1">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered List
    if (/^\d+\.\s/.test(line.trim())) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={key++} className="list-decimal list-inside space-y-1.5 my-3 text-slate-700 leading-relaxed text-sm">
          {listItems.map((item, idx) => (
            <li key={idx} className="pl-1">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty Line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Standard Paragraph
    elements.push(
      <p key={key++} className="text-slate-700 my-2.5 leading-relaxed text-sm sm:text-base">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
};

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let k = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/`([^`]+)`/);
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);

    type MatchResult = { index: number; length: number; node: React.ReactNode };
    const candidates: MatchResult[] = [];

    if (codeMatch && codeMatch.index !== undefined) {
      candidates.push({
        index: codeMatch.index,
        length: codeMatch[0].length,
        node: (
          <code key={k++} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs sm:text-sm font-mono border border-indigo-100">
            {codeMatch[1]}
          </code>
        )
      });
    }
    if (boldMatch && boldMatch.index !== undefined) {
      candidates.push({
        index: boldMatch.index,
        length: boldMatch[0].length,
        node: (
          <strong key={k++} className="font-semibold text-slate-900">
            {boldMatch[1]}
          </strong>
        )
      });
    }

    if (candidates.length === 0) {
      parts.push(<span key={k++}>{remaining}</span>);
      break;
    }

    candidates.sort((a, b) => a.index - b.index);
    const match = candidates[0];

    if (match.index > 0) {
      parts.push(<span key={k++}>{remaining.slice(0, match.index)}</span>);
    }
    parts.push(match.node);
    remaining = remaining.slice(match.index + match.length);
  }

  return <>{parts}</>;
}
