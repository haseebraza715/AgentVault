export default function PageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f5f1ea] text-[#181512]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-14">
        {children}
      </div>
    </div>
  );
}
