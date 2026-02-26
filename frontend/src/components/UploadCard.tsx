"use client";

import { useMemo, useState } from "react";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size >= 100 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".zip");
}

export default function UploadCard({
  uploading,
  uploadSuccess,
  selectedFile,
  processing,
  onSelectFile,
  onUpload,
  error,
  statusText,
}: {
  uploading: boolean;
  uploadSuccess: boolean;
  selectedFile: File | null;
  processing: boolean;
  onSelectFile: (file: File | null) => void;
  onUpload: () => void;
  error?: string | null;
  statusText?: string | null;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const fileMeta = useMemo(() => {
    if (!selectedFile) return null;
    return {
      name: selectedFile.name,
      size: formatBytes(selectedFile.size),
      valid: isZipFile(selectedFile),
    };
  }, [selectedFile]);

  const pickFile = (file: File | null) => {
    if (!file) {
      onSelectFile(null);
      setLocalError(null);
      return;
    }
    if (!isZipFile(file)) {
      onSelectFile(null);
      setLocalError("Only .zip files are supported.");
      return;
    }
    onSelectFile(file);
    setLocalError(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    pickFile(event.dataTransfer.files?.[0] ?? null);
  };

  const uploadLabel = uploading ? "Uploading..." : uploadSuccess ? "Uploaded" : "Upload and process";

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`rounded-lg border border-dashed bg-[#faf6f0] p-3 transition ${
          dragActive ? "border-[#1f4d45]" : "border-[#d9cbbd]"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <p className="text-sm font-semibold text-[#1f1914]">Drop vault zip</p>
        <p className="mt-1 text-xs text-[#5e554b]">Drag/drop a `.zip` file or select manually.</p>
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#cab8a2] bg-white px-3 py-1.5 text-xs font-medium text-[#2b241e] hover:bg-[#f8f0e5]">
          Select file
          <input
            type="file"
            accept=".zip"
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
      </div>

      {fileMeta ? (
        <div className="rounded-lg border border-[#d9c9b8] bg-white px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#2b241e]" title={fileMeta.name}>{fileMeta.name}</p>
              <p className="text-xs text-[#6f6255]">{fileMeta.size}</p>
            </div>
            <button
              type="button"
              onClick={() => pickFile(null)}
              className="rounded-md border border-[#d9cab7] px-2.5 py-1 text-xs text-[#6f6458] hover:bg-[#f5efe5]"
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onUpload}
          disabled={uploading || processing || !fileMeta?.valid}
          className="inline-flex min-w-[158px] items-center justify-center gap-2 rounded-md bg-[#1f4d45] px-3 py-2 text-xs font-semibold text-white hover:bg-[#173a34] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {uploading ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
          <span>{uploadLabel}</span>
        </button>
        {statusText ? <span className="rounded-full bg-[#efe6db] px-2.5 py-1 text-[11px] text-[#6f6458]">{statusText}</span> : null}
      </div>

      {processing ? <p className="text-[11px] text-[#1f4d45]">Processing in progress.</p> : null}
      {localError ? <p className="text-xs text-[#8b2b2b]">{localError}</p> : null}
      {error ? <p className="text-xs text-[#8b2b2b]">{error}</p> : null}
    </div>
  );
}
