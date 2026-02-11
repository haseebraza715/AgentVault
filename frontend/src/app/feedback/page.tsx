"use client";

import { useState } from "react";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function FeedbackPage() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    const res = await fetch(`${apiBaseUrl}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, email: email || undefined }),
    });
    if (res.ok) {
      setStatus("Thanks for the feedback.");
      setMessage("");
      setEmail("");
    } else {
      setStatus("Failed to send feedback.");
    }
  };

  return (
    <PageLayout>
      <div className="rounded-[28px] border border-[#e2d7ca] bg-white/95 p-6 shadow-[0_24px_60px_rgba(24,21,18,0.08)] sm:p-8 max-w-2xl">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#9a8878] sm:text-xs">
              AgentVault
            </p>
            <h1 className="text-2xl font-semibold text-[#181512] sm:text-3xl">
              Feedback
            </h1>
            <p className="text-xs text-[#6f6458] sm:text-sm">
              Tell us what worked, what didn&apos;t, and what you&apos;d like to
              see next.
            </p>
          </div>
          <Link
            href="/"
            className="mt-2 inline-flex items-center justify-center rounded-full border border-[#d9cbbd] bg-white px-3 py-1 text-[11px] font-medium text-[#2b241e] hover:bg-[#fbf7f1] sm:mt-0"
          >
            Back to landing
          </Link>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-4 text-sm text-[#2b241e]"
        >
          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-[#5f564c]">
              Your feedback
            </span>
            <textarea
              className="min-h-[140px] rounded-2xl border border-[#e2d7ca] bg-[#fbf7f1] p-3 text-sm outline-none ring-0 transition focus:border-[#1f4d45] focus:bg-white"
              placeholder="Share what you tried, what worked, where you got stuck, or what would make AgentVault more useful."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-[#5f564c]">
              Email (optional)
            </span>
            <input
              className="rounded-2xl border border-[#e2d7ca] bg-white p-3 text-sm outline-none ring-0 transition focus:border-[#1f4d45]"
              placeholder="We may follow up if we have questions."
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-[#1f4d45] px-5 py-2 text-sm font-medium text-white shadow-[0_12px_30px_rgba(17,38,33,0.25)] transition hover:-translate-y-[1px] hover:bg-[#173a34] sm:w-auto"
            >
              Send feedback
            </button>
            {status ? (
              <p className="text-xs text-[#6f6458] sm:text-sm">{status}</p>
            ) : null}
          </div>
        </form>
      </div>
    </PageLayout>
  );
}
