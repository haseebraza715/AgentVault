import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import SectionCard from "@/components/SectionCard";

const workflow = [
  "Upload vault zip",
  "Run guarded processing",
  "Review report and diffs",
  "Download cleaned output",
];

const features = [
  {
    title: "Deterministic review",
    body: "Per-note actions, counts, and searchable report rows.",
  },
  {
    title: "Safe rewriting",
    body: "Validation guards keep links, embeds, and structure stable.",
  },
  {
    title: "Fast export",
    body: "Download cleaned zip, preview markdown, and report JSON.",
  },
];

const links = [
  { label: "GitHub", href: "https://github.com/haseebraza715" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/haseebraza715" },
  { label: "X", href: "https://x.com/haseebraza715" },
];

export default function Home() {
  return (
    <PageLayout>
      <SectionCard
        title="AgentVault"
        description="A compact workspace for vault cleanup and verification."
      >
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <h1 className="text-[24px] leading-tight font-semibold text-[#1b1714]">
              Process vaults with less noise and clear review
            </h1>
            <p className="max-w-2xl text-xs text-[#4e463f]">
              Upload a vault zip, run guarded processing, inspect outcomes, and
              download clean outputs in Studio.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="inline-flex items-center justify-center rounded-md bg-[#1f4d45] px-3 py-1.5 text-[11px] font-semibold text-white"
                href="/studio"
              >
                Open Studio
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-md border border-[#d9cbbd] bg-white px-3 py-1.5 text-[11px] font-medium text-[#2b241e]"
                href="/feedback"
              >
                Send Feedback
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-[#ddd1c3] bg-[#fbf7f1] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b7c6d]">
              Workflow
            </p>
            <ol className="mt-2 space-y-1.5 text-xs text-[#4e463f]">
              {workflow.map((step, index) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#ccbda9] text-[10px] font-semibold text-[#6f6458]">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Highlights" description="Studio and Feedback use the same compact UI system.">
        <div className="grid gap-2 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-lg border border-[#e4d8cc] bg-[#fcf9f4] p-2.5">
              <p className="text-xs font-semibold text-[#2b241e]">{feature.title}</p>
              <p className="mt-1 text-[11px] text-[#6f6458]">{feature.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-[#6f6458]">Created by Haseeb Raza</p>
          {links.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[#d9cbbd] bg-white px-2 py-0.5 text-[10px] text-[#2b241e]"
            >
              {item.label}
            </a>
          ))}
        </div>
      </SectionCard>
    </PageLayout>
  );
}
