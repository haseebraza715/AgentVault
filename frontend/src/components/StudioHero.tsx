import Link from "next/link";

type HeroState = "idle" | "uploading" | "processing" | "done" | "error";

function getCopy(state: HeroState, processed: number, total: number): { title: string; body: string } {
  if (state === "processing") {
    return {
      title: `Processing your vault (${processed}/${total})`,
      body: "This may take a moment. You can track status below.",
    };
  }
  if (state === "done") {
    return {
      title: "Vault ready",
      body: "Review report and download outputs.",
    };
  }
  if (state === "error") {
    return {
      title: "Processing failed",
      body: "Try uploading again.",
    };
  }
  if (state === "uploading") {
    return {
      title: "Uploading vault",
      body: "Transfer in progress.",
    };
  }
  return {
    title: "Upload a vault",
    body: "Start with a .zip file and process it in Studio.",
  };
}

export default function StudioHero({
  state,
  processed,
  total,
}: {
  state: HeroState;
  processed: number;
  total: number;
}) {
  const copy = getCopy(state, processed, total);

  return (
    <header className="rounded-xl border border-[#dbcdbd] bg-white px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b7c6d]">Studio</p>
        <Link href="/" className="rounded-md border border-[#d9cbbd] px-2.5 py-1 text-xs text-[#2b241e]">
          Back to Home
        </Link>
      </div>
      <h1 className="text-[25px] leading-tight font-semibold text-[#181512]">{copy.title}</h1>
      <p className="mt-1.5 text-sm text-[#5f564c]">{copy.body}</p>
    </header>
  );
}
