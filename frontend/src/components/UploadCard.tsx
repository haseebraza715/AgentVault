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
        <p className="mt-1 text-xs text-[#6f6458]">
          Choose a .zip of your Obsidian vault. Every note is rewritten and
          indexed automatically.
        </p>
        <input
          type="file"
          accept=".zip"
          onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
          className="mt-4 w-full cursor-pointer text-xs text-[#2b241e] file:mr-3 file:cursor-pointer file:rounded-full file:border-none file:bg-[#181512] file:px-4 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-[#000000]"
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={onUpload}
          disabled={uploading}
          className="inline-flex w-full items-center justify-center rounded-full bg-[#1f4d45] px-5 py-2 text-sm font-medium text-white shadow-[0_12px_30px_rgba(17,38,33,0.25)] transition hover:-translate-y-[1px] hover:bg-[#173a34] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {uploading ? "Uploading..." : "Upload and process"}
        </button>
        {statusText ? (
          <span className="inline-flex w-full items-center justify-center rounded-full bg-[#efe6db] px-3 py-1 text-xs text-[#6f6458] sm:w-auto">
            {statusText}
          </span>
        ) : null}
      </div>
      {error ? <p className="text-sm text-[#8b2b2b]">{error}</p> : null}
    </div>
  );
}
