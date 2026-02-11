export default function StatusPill({
  status,
  detail,
}: {
  status: string;
  detail?: string;
}) {
  const isOk = status === "ok";
  const bg = isOk
    ? "bg-[#e7f3ec] text-[#216149]"
    : "bg-[#fbeaea] text-[#8b2b2b]";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${bg}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      <span className="font-medium uppercase tracking-[0.2em]">{status}</span>
      {detail ? <span className="text-[11px]">{detail}</span> : null}
    </div>
  );
}
