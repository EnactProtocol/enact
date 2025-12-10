import Spinner from "@/components/ui/Spinner";
import { getLanguageFromPath, highlightCode } from "@/lib/shiki";
import { useEffect, useState } from "react";

interface CodeViewerProps {
  code: string;
  filePath: string;
  showLineNumbers?: boolean;
}

export default function CodeViewer({ code, filePath, showLineNumbers = true }: CodeViewerProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Normalize line endings (remove \r from Windows-style \r\n)
  const normalizedCode = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  useEffect(() => {
    let cancelled = false;

    async function highlight() {
      setIsLoading(true);
      try {
        const lang = getLanguageFromPath(filePath);
        let html = await highlightCode(normalizedCode, lang, "github-dark");
        // Remove newlines between .line spans to prevent double-spacing
        // Shiki outputs: </span>\n<span class="line"> which causes whitespace issues
        html = html.replace(/>\n<span class="line">/g, '><span class="line">');
        if (!cancelled) {
          setHighlightedHtml(html);
        }
      } catch (err) {
        console.error("Failed to highlight code:", err);
        if (!cancelled) {
          // Fallback to plain text
          setHighlightedHtml(`<pre><code>${escapeHtml(normalizedCode)}</code></pre>`);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    highlight();

    return () => {
      cancelled = true;
    };
  }, [normalizedCode, filePath]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
      </div>
    );
  }

  if (!highlightedHtml) {
    return (
      <pre className="p-4 text-sm font-mono text-gray-300 bg-gray-900 rounded overflow-x-auto">
        <code>{normalizedCode}</code>
      </pre>
    );
  }

  const lines = normalizedCode.split("\n");

  return (
    <div className="relative overflow-x-auto bg-[#0d1117] rounded-lg">
      <div className="flex">
        {showLineNumbers && (
          <div className="flex-shrink-0 py-4 pr-4 text-right select-none border-r border-gray-800">
            {lines.map((_, i) => (
              <div
                key={`line-${i + 1}`}
                className="px-3 text-sm leading-6 text-gray-500 font-mono h-6"
              >
                {i + 1}
              </div>
            ))}
          </div>
        )}
        <div
          className="flex-1 p-4 overflow-x-auto code-viewer"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is sanitized
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </div>
      <style>{`
        .code-viewer pre {
          margin: 0;
          padding: 0;
          background: transparent !important;
          white-space: pre;
        }
        .code-viewer code {
          font-size: 0.875rem;
          line-height: 1.5rem;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
          display: block;
        }
        .code-viewer .line {
          display: block;
          min-height: 1.5rem;
        }
        .code-viewer .line:empty::after {
          content: ' ';
        }
      `}</style>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
