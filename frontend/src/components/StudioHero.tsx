import Link from "next/link";

export default function StudioHero() {
  return (
    <header className="av-surface p-5 sm:p-7 lg:p-8">
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-2xl bg-[#181512] text-[11px] font-semibold text-[#f5f1ea] shadow-[0_10px_28px_rgba(0,0,0,0.25)]">
              AV
            </div>
            <div className="flex flex-col leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-[#9a8878] sm:text-xs">
                AgentVault Studio
              </p>
              <p className="text-[11px] text-[#8b7c6d]">
                One lane from raw vault to agent workspace.
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="av-chip px-3 py-1 text-[11px] font-medium text-[#2b241e] hover:bg-white"
          >
            Back to landing
          </Link>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-xl flex-col gap-2">
            <h1 className="text-2xl font-semibold text-[#181512] sm:text-3xl">
              Clean, index, and preview your vault.
            </h1>
            <p className="text-sm text-[#5f564c] sm:text-base">
              Upload once, let the model standardise your notes, and leave with a
              vault that feels handcrafted for agents.
            </p>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-[11px] text-[#5f564c] sm:mt-1 sm:text-sm">
            <div className="space-y-1">
              <dt className="font-medium text-[#2b241e]">Steps</dt>
              <dd className="leading-snug">
                Upload → Rewrite → Preview → Download.
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-medium text-[#2b241e]">Output</dt>
              <dd className="leading-snug">
                Cleaned zip + stitched markdown preview.
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </header>
  );
}
