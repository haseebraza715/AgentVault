export default function FooterStatus({ status }: { status: string }) {
  const isOk = status === "ok";
  return (
    <footer className="mt-6 flex items-center justify-between text-xs text-[#8a8176]">
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
