import type { ReactNode } from "react";

function Glyph({ children }: { children: ReactNode }) {
  return <span className="rounded bg-current/10 px-1 py-0.5 font-mono text-[10px] text-current/85">{children}</span>;
}

function ActionButton({
  href,
  primary,
  label,
  onClick,
  icon,
}: {
  href?: string;
  primary?: boolean;
  label: string;
  onClick?: () => void;
  icon: ReactNode;
}) {
  if (!href) {
    return (
      <div className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-md border border-[#dbcdbb] bg-[#faf5ee] px-2.5 text-[11px] font-medium text-[#a29688]">
        <Glyph>{icon}</Glyph>
        <span className="whitespace-nowrap">{label}</span>
      </div>
    );
  }

  return (
    <a
      className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold transition ${
        primary
          ? "bg-[#11100f] text-white hover:bg-[#1d1a17]"
          : "border border-[#ccb9a4] bg-white text-[#2b241e] hover:bg-[#f8f1e7]"
      }`}
      href={href}
      onClick={onClick}
    >
      <Glyph>{icon}</Glyph>
      <span className="whitespace-nowrap">{label}</span>
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
        <div className="rounded-lg border border-[#c8decd] bg-[#edf7f0] px-2.5 py-2 text-[11px] text-[#1f4d45]">
          {noteCount ? `${noteCount} notes processed.` : "Ready."}
          {zipSizeLabel ? ` Zip: ${zipSizeLabel}.` : ""}
        </div>
      ) : (
        <div className="rounded-lg border border-[#dccdbb] bg-[#f8f1e7] px-2.5 py-2 text-[11px] text-[#61574c]">
          Upload a vault to unlock downloads.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <ActionButton
          href={enabled && zipUrl ? zipUrl : undefined}
          primary
          label="Cleaned Zip"
          icon={"ZIP"}
          onClick={() => onDownload?.("Cleaned zip download started")}
        />
        <ActionButton
          href={enabled && previewUrl ? previewUrl : undefined}
          label="Preview MD"
          icon={"MD"}
          onClick={() => onDownload?.("Preview markdown download started")}
        />
        <ActionButton
          href={enabled && reportUrl ? reportUrl : undefined}
          label="Report JSON"
          icon={"{}"}
          onClick={() => onDownload?.("Report download started")}
        />
      </div>
    </div>
  );
}
