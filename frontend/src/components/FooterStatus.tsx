export default function FooterStatus({ status }: { status: string }) {
  const isOk = status === "ok";
  return (
    <footer className="mt-0.5 flex items-center justify-between rounded-lg border border-[#dccfbe] bg-white px-3 py-2 text-[11px] text-[#7f756b]">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isOk ? "bg-[#1f9d66]" : "bg-[#d05555]"}`} />
        <span>Backend: {status}</span>
      </div>
      <span>AgentVault Studio</span>
    </footer>
  );
}
