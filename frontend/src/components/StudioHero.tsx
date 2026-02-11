import Link from "next/link";

export default function StudioHero() {
  return (
    <header className="rounded-[32px] border border-[#e2d7ca] bg-white/95 p-10 shadow-[0_28px_70px_rgba(24,21,18,0.1)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.42em] text-[#9a8878]">
            AgentVault Studio
          </p>
          <Link
            href="/"
            className="rounded-full border border-[#d9cbbd] bg-white px-3 py-1 text-xs font-medium text-[#2b241e]"
          >
            Back to landing
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-[#181512]">Studio</h1>
          <p className="text-base text-[#5f564c]">
            Upload a vault, let the model rewrite every note, and download both
            the cleaned zip and a full markdown preview.
          </p>
        </div>
      </div>
    </header>
  );
}
