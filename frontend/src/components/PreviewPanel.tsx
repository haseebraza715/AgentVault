import { useEffect, useState } from "react";

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#2b241e]">Preview (in browser)</p>
        {loading ? (
          <span className="text-xs text-[#6f6458]">Loading...</span>
        ) : null}
      </div>
      {error ? <p className="text-sm text-[#8b2b2b]">{error}</p> : null}
      <div className="max-h-[420px] overflow-auto rounded-2xl border border-[#e2d7ca] bg-[#fbf7f1] p-4 text-sm text-[#2b241e]">
        {content ? (
          <pre className="whitespace-pre-wrap font-sans text-sm">{content}</pre>
        ) : (
          <p className="text-sm text-[#6f6458]">
            Preview will appear here once processing is complete.
          </p>
        )}
      </div>
    </div>
  );
}
