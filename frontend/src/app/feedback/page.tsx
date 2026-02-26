"use client";

import Link from "next/link";
import { useState } from "react";
import PageLayout from "@/components/PageLayout";
import SectionCard from "@/components/SectionCard";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type SubmitState = "idle" | "success" | "error";

export default function FeedbackPage() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmitState>("idle");
  const [statusText, setStatusText] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setStatus("idle");
    setStatusText("");

    try {
      const res = await fetch(`${apiBaseUrl}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email: email || undefined }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setStatus("success");
      setStatusText("Thanks. Feedback received.");
      setMessage("");
      setEmail("");
    } catch {
      setStatus("error");
      setStatusText("Could not send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <SectionCard title="Feedback" description="Help improve Studio UX and backend reliability.">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-2.5">
            <Link
              href="/studio"
              className="inline-flex rounded-md border border-[#d9cbbd] bg-white px-3 py-1.5 text-xs text-[#2b241e]"
            >
              Back to Studio
            </Link>

            <div className="rounded-lg border border-[#ddd1c3] bg-[#fbf7f1] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b7c6d]">
                Useful Details
              </p>
              <ul className="mt-2 space-y-1 text-xs text-[#5f564c]">
                <li>What you were trying to do</li>
                <li>What happened instead</li>
                <li>Any error text or screenshot context</li>
              </ul>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
            <textarea
              className="min-h-[130px] rounded-md border border-[#d9cbbd] bg-[#fbf7f1] p-3 text-sm text-[#2b241e] outline-none focus:border-[#1f4d45]"
              placeholder="Write your feedback"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
            <input
              className="rounded-md border border-[#d9cbbd] bg-white px-3 py-2.5 text-sm text-[#2b241e] outline-none focus:border-[#1f4d45]"
              placeholder="Email (optional)"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="w-fit rounded-md bg-[#1f4d45] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#173a34] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Send feedback"}
            </button>
            {statusText ? (
              <p
                className={`text-xs ${
                  status === "error" ? "text-[#8b2b2b]" : "text-[#4e463f]"
                }`}
              >
                {statusText}
              </p>
            ) : null}
          </form>
        </div>
      </SectionCard>
    </PageLayout>
  );
}
