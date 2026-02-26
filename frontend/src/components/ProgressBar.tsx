export default function ProgressBar({
  current,
  total,
  etaLabel,
}: {
  current: number;
  total: number;
  etaLabel?: string;
}) {
  const safeTotal = total > 0 ? total : 1;
  const percent = Math.min(100, Math.max(0, Math.round((current / safeTotal) * 100)));

  return (
    <div className="rounded-lg border border-[#dbcdbd] bg-white p-2.5">
      <div className="mb-1 flex items-center justify-between text-[11px] text-[#6f6458]">
        <span className="font-medium">Progress</span>
        <span className="tabular-nums">{percent}% ({current}/{total})</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#e6dacd]">
        <div
          className="h-full rounded-full bg-[#1f4d45] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-[#7f7265]">{etaLabel ? `ETA: ${etaLabel}` : "Estimating..."}</p>
    </div>
  );
}
