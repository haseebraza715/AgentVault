import TopNav from "@/components/TopNav";

export default function PageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4efe6] text-[#181512]">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-3 py-4 sm:px-4 sm:py-5">
        <TopNav />
        {children}
      </div>
    </div>
  );
}
