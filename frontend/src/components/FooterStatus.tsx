export default function FooterStatus({ status }: { status: string }) {
  const isOk = status === "ok";
  return (
    <footer className="mt-6 flex flex-col gap-2 text-xs text-[#8a8176] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            isOk ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />
        <span>Backend: {status}</span>
      </div>
      <span>AgentVault Studio</span>
    </footer>
  );
}
