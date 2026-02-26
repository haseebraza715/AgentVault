import type { ReactNode } from "react";

function Glyph({ children }: { children: ReactNode }) {
  return <span className="rounded bg-current/10 px-1.5 py-0.5 font-mono text-[11px] text-current/85">{children}</span>;
}

function ActionButton({
  href,
  primary,
  label,
  onClick,
  icon,
  className,
}: {
  href?: string;
  primary?: boolean;
  label: string;
  onClick?: () => void;
  icon: ReactNode;
  className?: string;
}) {
  if (!href) {
    return (
      <div
        className={`inline-flex items-center justify-center gap-2 rounded-md border border-[#dbcdbb] bg-[#faf5ee] px-3 text-xs font-medium text-[#a29688] ${
          primary ? "min-h-[44px]" : "min-h-[40px]"
        } ${className || ""}`}
      >
        <Glyph>{icon}</Glyph>
        <span className="text-center leading-tight">{label}</span>
      </div>
    );
  }

  return (
    <a
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 font-semibold transition ${
        primary
          ? "min-h-[44px] bg-[#11100f] px-4 text-sm text-white shadow-[0_1px_0_rgba(0,0,0,0.18)] hover:bg-[#1d1a17]"
          : "min-h-[40px] border border-[#ccb9a4] bg-white text-xs text-[#2b241e] hover:bg-[#f8f1e7]"
      } ${className || ""}`}
      href={href}
      onClick={onClick}
    >
      <Glyph>{icon}</Glyph>
      <span className="text-center leading-tight">{label}</span>
    </a>
  );
}

export default function DownloadCard({
  zipUrl,
  previewUrl,
  reportUrl,
  enabled,
  noteCount,
  zipSizeLabel,
  onDownload,
}: {
  zipUrl?: string | null;
  previewUrl?: string | null;
  reportUrl?: string | null;
  enabled: boolean;
  noteCount?: number;
  zipSizeLabel?: string | null;
  onDownload?: (label: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {enabled ? (
        <div className="rounded-lg border border-[#c8decd] bg-[#edf7f0] px-3 py-2.5 text-xs text-[#1f4d45]">
          {noteCount ? `${noteCount} notes processed.` : "Ready."}
          {zipSizeLabel ? ` Zip: ${zipSizeLabel}.` : ""}
        </div>
      ) : (
        <div className="rounded-lg border border-[#dccdbb] bg-[#f8f1e7] px-3 py-2.5 text-xs text-[#61574c]">
          Upload a vault to unlock downloads.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <ActionButton
          href={enabled && zipUrl ? zipUrl : undefined}
          primary
          className="sm:col-span-2"
          label="Download cleaned vault (.zip)"
          icon={"ZIP"}
          onClick={() => onDownload?.("Cleaned zip download started")}
        />
        <ActionButton
          href={enabled && previewUrl ? previewUrl : undefined}
          label="Open preview"
          icon={"MD"}
          onClick={() => onDownload?.("Preview markdown download started")}
        />
        <ActionButton
          href={enabled && reportUrl ? reportUrl : undefined}
          label="Download report (JSON)"
          icon={"{}"}
          onClick={() => onDownload?.("Report download started")}
        />
      </div>
    </div>
  );
}
