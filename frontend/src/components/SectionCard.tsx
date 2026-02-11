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
    <section className="rounded-3xl border border-[#e2d7ca] bg-white/95 p-5 shadow-[0_24px_60px_rgba(24,21,18,0.1)] sm:p-7">
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8b7c6d] sm:text-xs">
          {title}
        </p>
        {description ? (
          <p className="text-xs text-[#5f564c] sm:text-sm">{description}</p>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
