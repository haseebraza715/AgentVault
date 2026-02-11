import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

function splitPreview(content: string) {
  const parts = content.split("\n---\n");
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lines = part.split("\n");
      const titleLine = lines.find((line) => line.startsWith("## "));
      const title = titleLine ? titleLine.replace(/^##\s+/, "") : "Note";
      return { title, body: part };
    });
}

export default function PreviewPanel({
  previewUrl,
  enabled,
}: {
  previewUrl?: string | null;
  enabled: boolean;
}) {
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    if (!enabled || !previewUrl) {
      setContent("");
      return;
    }

    let active = true;
    const loadPreview = async () => {
      try {
        setLoading(true);
        const res = await fetch(previewUrl);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const text = await res.text();
        if (active) {
          setContent(text);
        }
      } catch (err) {
        if (active) {
          setError((err as Error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      active = false;
    };
  }, [enabled, previewUrl]);

  const sections = useMemo(() => splitPreview(content), [content]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#2b241e]">Preview</p>
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs text-[#6f6458]">Loading...</span>
          ) : null}
          {content ? (
            <button
              type="button"
              onClick={() => setExpandAll((prev) => !prev)}
              className="rounded-full border border-[#d9cbbd] bg-white px-3 py-1 text-xs font-medium text-[#2b241e]"
            >
              {expandAll ? "Collapse all" : "Expand all"}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-[#8b2b2b]">{error}</p> : null}
      <div className="max-h-[60vh] space-y-3 overflow-auto rounded-2xl border border-[#e2d7ca] bg-[#fbf7f1] p-3 text-sm text-[#2b241e] md:max-h-[520px] md:p-4">
        {content ? (
          sections.map((section, index) => (
            <details
              key={`${section.title}-${index}`}
              open={expandAll}
              className="rounded-xl border border-[#e2d7ca] bg-white/80 p-3"
            >
              <summary className="cursor-pointer text-sm font-semibold text-[#1b1714]">
                {section.title}
              </summary>
              <div className="mt-3">
                <article className="prose prose-sm max-w-none prose-headings:font-display prose-headings:text-[#1b1714] prose-p:text-[#2b241e] prose-li:text-[#2b241e] prose-strong:text-[#1b1714] prose-code:text-[#1f4d45]">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {section.body}
                  </ReactMarkdown>
                </article>
              </div>
            </details>
          ))
        ) : (
          <p className="text-sm text-[#6f6458]">
            Preview will appear here once processing is complete.
          </p>
        )}
      </div>
    </div>
  );
}
