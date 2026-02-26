"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/studio", label: "Studio" },
  { href: "/feedback", label: "Feedback" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-2 z-20 flex items-center justify-between rounded-lg border border-[#d8cbbd] bg-white/95 px-2.5 py-1.5 backdrop-blur">
      <Link
        href="/"
        className="rounded-md px-1.5 py-1 text-[13px] font-semibold tracking-[0.05em] text-[#1f1a15]"
      >
        AgentVault
      </Link>
      <div className="flex items-center gap-1">
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                active
                  ? "bg-[#1f4d45] text-white"
                  : "text-[#5f564c] hover:bg-[#f4ede3]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
