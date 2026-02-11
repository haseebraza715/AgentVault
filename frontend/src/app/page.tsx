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
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-20">
        <header className="flex flex-col gap-6">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#7f6e60]">
            AgentVault
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-[#1b1714]">
            Turn raw vaults into curated, agent-ready knowledge.
          </h1>
          <p className="max-w-2xl text-lg text-[#4e463f]">
            AgentVault rewrites every note with your LLM, preserves links and
            code, and ships a clean index plus a full markdown preview for quick
            review.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              className="inline-flex items-center justify-center rounded-full bg-[#1f4d45] px-6 py-3 text-sm font-medium text-white shadow-[0_12px_30px_rgba(17,38,33,0.25)]"
              href="/studio"
            >
              Open Studio
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-full border border-[#d9cbbd] px-6 py-3 text-sm font-medium text-[#2b241e]"
              href="/feedback"
            >
              Share Feedback
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
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
            <div
              key={item.title}
              className="rounded-3xl border border-[#e2d7ca] bg-white/90 p-6 shadow-[0_20px_50px_rgba(24,21,18,0.08)]"
            >
              <p className="text-sm font-semibold text-[#2b241e]">
                {item.title}
              </p>
              <p className="mt-2 text-sm text-[#4e463f]">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-[#e2d7ca] bg-white/90 p-8 shadow-[0_20px_50px_rgba(24,21,18,0.08)]">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7f6e60]">
                Crafted by
              </p>
              <p className="mt-2 text-3xl font-semibold text-[#1b1714]">
                Haseeb Raza
              </p>
            </div>
            <p className="text-base text-[#4e463f]">
              Building agent-first knowledge workflows. Find me as
              <span className="font-semibold text-[#2b241e]"> haseebraza715</span>{" "}
              across GitHub, LinkedIn, and X.
            </p>
            <div className="flex flex-wrap gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="rounded-full border border-[#d9cbbd] bg-white px-3 py-1 text-xs text-[#2b241e]"
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
