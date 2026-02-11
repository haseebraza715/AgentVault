export default function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#e2d7ca] bg-white/95 p-7 shadow-[0_24px_60px_rgba(24,21,18,0.1)]">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b7c6d]">
          {title}
        </p>
        {description ? (
          <p className="text-sm text-[#5f564c]">{description}</p>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
