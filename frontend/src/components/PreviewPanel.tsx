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
      setError(null);
      return;
    }

    let active = true;
    const loadPreview = async () => {
      try {
        setError(null);
        setLoading(true);
        const res = await fetch(previewUrl);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Preview expired. Upload the vault again.");
          }
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5f564c]">Preview</p>
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-[10px] text-[#6f6458]">Loading...</span>
          ) : null}
          {content ? (
            <button
              type="button"
              onClick={() => setExpandAll((prev) => !prev)}
              className="rounded-md border border-[#d9cbbd] bg-white px-2 py-0.5 text-[10px] text-[#2b241e]"
            >
              {expandAll ? "Collapse all" : "Expand all"}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-xs text-[#8b2b2b]">{error}</p> : null}
      <div className={`max-h-[460px] space-y-2 overflow-auto rounded-lg border border-[#e2d7ca] bg-[#fbf7f1] p-2.5 text-xs text-[#2b241e] transition ${content ? "opacity-100" : "opacity-85"}`}>
        {content ? (
          sections.map((section, index) => (
            <details
              key={`${section.title}-${index}`}
              open={expandAll}
              className="rounded-lg border border-[#e2d7ca] bg-white p-2"
            >
              <summary className="cursor-pointer text-[11px] font-semibold text-[#1b1714]">
                {section.title}
              </summary>
              <div className="mt-1.5">
                <article className="prose prose-sm max-w-none prose-headings:text-[#1b1714] prose-p:text-[#2b241e] prose-li:text-[#2b241e] prose-strong:text-[#1b1714] prose-code:text-[#1f4d45] prose-p:my-1.5 prose-li:my-0.5">
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
          <div className="rounded-lg border border-dashed border-[#dacdbf] bg-white/70 px-2.5 py-4 text-center">
            <p className="text-[11px] font-medium text-[#5f564c]">No preview yet</p>
            <p className="mt-1 text-[11px] text-[#7b6f62]">Upload a vault above to generate a preview.</p>
          </div>
        )}
      </div>
    </div>
  );
}
