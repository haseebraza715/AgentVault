export default function DownloadCard({
  zipUrl,
  previewUrl,
  enabled,
}: {
  zipUrl?: string | null;
  previewUrl?: string | null;
  enabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[#5f564c]">
        Download the cleaned vault or grab the full markdown preview.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {enabled && zipUrl ? (
          <a
            className="inline-flex w-full items-center justify-center rounded-full bg-[#181512] px-5 py-2 text-sm font-medium text-white transition hover:-translate-y-[1px] hover:bg-black sm:w-auto"
            href={zipUrl}
          >
            Download cleaned zip
          </a>
        ) : (
          <span className="text-sm text-[#9a8878]">
            Zip download unavailable
          </span>
        )}
        {enabled && previewUrl ? (
          <a
            className="inline-flex w-full items-center justify-center rounded-full border border-[#e2d7ca] bg-white px-5 py-2 text-sm font-medium text-[#2b241e] transition hover:-translate-y-[1px] hover:bg-[#fbf7f1] sm:w-auto"
            href={previewUrl}
          >
            Download preview markdown
          </a>
        ) : null}
      </div>
    </div>
  );
}
