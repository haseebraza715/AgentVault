export default function UploadCard({
  uploading,
  onSelectFile,
  onUpload,
  error,
  statusText,
}: {
  uploading: boolean;
  onSelectFile: (file: File | null) => void;
  onUpload: () => void;
  error?: string | null;
  statusText?: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-3xl border border-dashed border-[#e2d7ca] bg-[#fbf7f1] p-6">
        <p className="text-sm font-medium text-[#2b241e]">Vault zip</p>
        <p className="text-xs text-[#6f6458]">
          Choose a .zip of your Obsidian vault. Every note is rewritten and
          indexed automatically.
        </p>
        <input
          type="file"
          accept=".zip"
          onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
          className="mt-4 text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onUpload}
          disabled={uploading}
          className="inline-flex items-center justify-center rounded-full bg-[#1f4d45] px-5 py-2 text-sm font-medium text-white shadow-[0_12px_30px_rgba(17,38,33,0.25)] transition hover:-translate-y-[1px] hover:bg-[#173a34] disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload and process"}
        </button>
        {statusText ? (
          <span className="rounded-full bg-[#efe6db] px-3 py-1 text-xs text-[#6f6458]">
            {statusText}
          </span>
        ) : null}
      </div>
      {error ? <p className="text-sm text-[#8b2b2b]">{error}</p> : null}
    </div>
  );
}
