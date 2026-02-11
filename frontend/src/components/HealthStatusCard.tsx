import StatusPill from "./StatusPill";

export default function HealthStatusCard({
  status,
  detail,
}: {
  status: string;
  detail?: string;
}) {
  const helpText =
    status === "ok"
      ? "Backend is reachable."
      : "Start the backend and confirm NEXT_PUBLIC_API_URL points to it.";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-[#3b332c]">Backend health</p>
        <p className="text-xs text-[#8a8176]">{helpText}</p>
      </div>
      <StatusPill status={status} detail={detail} />
    </div>
  );
}
