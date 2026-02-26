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
    <section className="rounded-xl border border-[#dbcdbd] bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b7c6d]">
          {title}
        </p>
        {description ? <p className="text-sm text-[#5f564c]">{description}</p> : null}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}
