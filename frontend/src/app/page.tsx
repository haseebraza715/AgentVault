import Link from "next/link";

const socialLinks = [
  {
    label: "GitHub",
    href: "https://github.com/haseebraza715",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/haseebraza715",
  },
  {
    label: "X",
    href: "https://x.com/haseebraza715",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f5f1ea] text-[#181512]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-14">
        <nav className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#181512] text-xs font-semibold text-[#f5f1ea] shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              AV
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7f6e60]">
                AgentVault
              </span>
              <span className="text-[11px] text-[#8b7c6d]">
                Agent-ready knowledge from messy vaults
              </span>
            </div>
          </div>
          <Link
            href="/studio"
            className="hidden items-center gap-2 rounded-full bg-[#1f4d45] px-4 py-2 text-xs font-medium text-white shadow-[0_10px_26px_rgba(17,38,33,0.35)] transition hover:-translate-y-[1px] hover:bg-[#173a34] sm:inline-flex"
          >
            Open Studio
          </Link>
        </nav>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center">
          <header className="flex flex-col gap-5 sm:gap-6">
            <p className="inline-flex max-w-max items-center gap-2 rounded-full border border-[#e2d7ca] bg-white/60 px-3 py-1 text-[11px] text-[#7f6e60] backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Built for AI-native note workflows</span>
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-[#1b1714] sm:text-4xl md:text-5xl">
              Turn raw vaults into curated, agent-ready knowledge.
            </h1>
            <p className="max-w-2xl text-base text-[#4e463f] sm:text-lg">
              AgentVault rewrites every note with your LLM, preserves links and
              code blocks, and ships a clean index plus a full markdown preview
              you can diff, skim, and trust.
            </p>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <Link
                className="inline-flex items-center justify-center rounded-full bg-[#1f4d45] px-6 py-3 text-sm font-medium text-white shadow-[0_12px_30px_rgba(17,38,33,0.25)] transition hover:-translate-y-[1px] hover:bg-[#173a34]"
                href="/studio"
              >
                Open Studio
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-full border border-[#d9cbbd] px-6 py-3 text-sm font-medium text-[#2b241e] bg-white/70 backdrop-blur transition hover:-translate-y-[1px]"
                href="/feedback"
              >
                Share Feedback
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#7f6e60]">
              <div className="flex flex-col">
                <span className="font-semibold text-[#2b241e]">Zero schema</span>
                <span>No upfront modeling or tagging required.</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-[#2b241e]">
                  Vault-safe output
                </span>
                <span>Preserves your structure, links, and filenames.</span>
              </div>
            </div>
          </header>

          <aside className="relative">
            <div className="av-surface av-grid-lines relative overflow-hidden p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-[#5f564c]">
                  How AgentVault processes a vault
                </p>
                <span className="av-chip px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#7f6e60]">
                  Studio flow
                </span>
              </div>
              <ol className="space-y-3 text-xs text-[#4e463f] sm:text-[13px]">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#1f4d45] text-[11px] font-semibold text-white shadow-[0_4px_10px_rgba(17,38,33,0.35)]">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-[#2b241e]">
                      Upload your Obsidian vault zip
                    </p>
                    <p>We never touch your original files on disk.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#1f4d45] text-[11px] font-semibold text-white shadow-[0_4px_10px_rgba(17,38,33,0.35)]">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-[#2b241e]">
                      Rewrite + index every note
                    </p>
                    <p>
                      The LLM cleans wording, standardises headings, and builds a
                      searchable index for agents.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#1f4d45] text-[11px] font-semibold text-white shadow-[0_4px_10px_rgba(17,38,33,0.35)]">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-[#2b241e]">
                      Inspect the markdown preview
                    </p>
                    <p>
                      Browse a stitched markdown preview in Studio before you ever
                      download the cleaned zip.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 pt-4 md:grid-cols-3">
          {[
            {
              title: "Rewrite",
              desc: "LLM rewrites every note into a clear, structured format.",
            },
            {
              title: "Index",
              desc: "Get a vault-wide index and entity rollup automatically.",
            },
            {
              title: "Preview",
              desc: "Download a full markdown preview before the zip.",
            },
          ].map((item) => (
            <div key={item.title} className="av-surface p-5 sm:p-6">
              <p className="text-sm font-semibold text-[#2b241e]">
                {item.title}
              </p>
              <p className="mt-2 text-sm text-[#4e463f]">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-[#e2d7ca] bg-white/90 p-6 shadow-[0_20px_50px_rgba(24,21,18,0.08)] sm:p-8">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7f6e60]">
                Crafted by
              </p>
              <p className="mt-2 text-2xl font-semibold text-[#1b1714] sm:text-3xl">
                Haseeb Raza
              </p>
            </div>
            <p className="text-base text-[#4e463f]">
              Building agent-first knowledge workflows. Find me as
              <span className="font-semibold text-[#2b241e]"> haseebraza715</span>{" "}
              across GitHub, LinkedIn, and X.
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="rounded-full border border-[#d9cbbd] bg-white/80 px-3 py-1 text-xs text-[#2b241e] hover:bg-white"
                >
                  {link.label} · haseebraza715
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
