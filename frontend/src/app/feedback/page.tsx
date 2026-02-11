"use client";

import { useState } from "react";

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
    <div className="min-h-screen bg-white text-zinc-900">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Feedback</h1>
          <p className="text-zinc-600">Tell us what worked and what did not.</p>
        </header>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <textarea
            className="min-h-[140px] rounded-md border border-zinc-200 p-3 text-sm"
            placeholder="Your feedback"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />
          <input
            className="rounded-md border border-zinc-200 p-3 text-sm"
            placeholder="Email (optional)"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Send Feedback
          </button>
          {status ? <p className="text-sm text-zinc-600">{status}</p> : null}
        </form>
      </main>
    </div>
  );
}
