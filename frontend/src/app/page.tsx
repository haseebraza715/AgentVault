import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import SectionCard from "@/components/SectionCard";

const howItWorks = [
  {
    title: "Upload",
    body: "Upload your Obsidian vault zip to start a processing job.",
  },
  {
    title: "Repair & validate",
    body: "Deterministic repair runs first, then guarded AI rewrite and structure checks.",
  },
  {
    title: "Review diffs + download",
    body: "Inspect per-note diffs and report details, then download the cleaned vault zip.",
  },
];

const safetyBullets = [
  "Preserves frontmatter, links, embeds, and code blocks",
  "Deterministic cleaning before LLM",
  "Quality guards with automatic fallback",
  "Per-note report and diff viewer",
];

const outputs = [
  "Cleaned vault zip",
  "Preview.md",
  "Report JSON",
  "index.md + entities.md",
];

const trustNotes = [
  "Structure preserved: frontmatter, wikilinks, embeds, and code fences.",
  "Clear review path with per-note report rows and diff viewer.",
  "Guarded processing with deterministic fallback when checks fail.",
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
        description="Safe Obsidian vault processing from upload to verified output."
      >
        <div className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="max-w-2xl space-y-3">
            <h1 className="text-[30px] leading-tight font-semibold text-[#1b1714] sm:text-[34px]">
              Safe AI cleanup for Obsidian vaults
            </h1>
            <p className="text-sm text-[#4e463f] sm:text-[15px]">
              Deterministic fixes first, guarded AI second. Review every
              change and download a cleaned vault.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="inline-flex items-center justify-center rounded-md bg-[#1f4d45] px-4 py-2 text-sm font-semibold text-white"
                href="/studio"
              >
                Upload vault zip
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-md border border-[#d9cbbd] bg-white px-4 py-2 text-sm font-medium text-[#2b241e]"
                href="#how-it-works"
              >
                See how it works
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-[#ddd1c3] bg-[#fbf7f1] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b7c6d]">
              Built for trust
            </p>
            <ul className="mt-2.5 space-y-2 text-sm text-[#4e463f]">
              {trustNotes.map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[#8b7c6d]" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>

      <section id="how-it-works" className="scroll-mt-20">
        <SectionCard title="How It Works" description="Three steps from raw vault to verified output.">
          <div className="grid gap-2.5 md:grid-cols-3">
            {howItWorks.map((step, index) => (
              <div key={step.title} className="rounded-lg border border-[#e4d8cc] bg-[#fcf9f4] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b7c6d]">
                  Step {index + 1}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#2b241e]">{step.title}</p>
                <p className="mt-1.5 text-xs text-[#6f6458]">{step.body}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Why It’s Safe" description="Core safeguards for predictable vault cleanup.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {safetyBullets.map((item) => (
            <li key={item} className="rounded-lg border border-[#e4d8cc] bg-[#fcf9f4] p-3 text-sm text-[#4e463f]">
              {item}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="What You Get" description="Output bundle from each completed job.">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {outputs.map((item) => (
            <div key={item} className="rounded-lg border border-[#e4d8cc] bg-[#fcf9f4] p-3">
              <p className="text-sm font-semibold text-[#2b241e]">{item}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-[#6f6458]">
          Privacy: files are processed on our server for the active job, we do not train on your
          data, and you should avoid uploading vaults with secrets.
        </p>
      </SectionCard>

      <SectionCard title="Created By">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-[#6f6458]">Created by Haseeb Raza</p>
          {links.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[#d9cbbd] bg-white px-2.5 py-1 text-[11px] text-[#2b241e]"
            >
              {item.label}
            </a>
          ))}
        </div>
      </SectionCard>
    </PageLayout>
  );
}
