"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "That access code isn't right.");
      }

      const next = searchParams.get("next");
      // A full navigation (not the client router) so the freshly-set auth
      // cookie is guaranteed to be picked up on the very next request.
      window.location.href = next && next.startsWith("/") ? next : "/";
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-shell surface-panel">
      <p className="brand-mark">Keyword Access</p>
      <h1>Staff access</h1>
      <p className="subtle-copy">Enter the access code your team lead shared with you.</p>
      <form onSubmit={handleSubmit} className="composer">
        <input
          type="password"
          className="composer-input"
          placeholder="Access code"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
        />
        {error ? <p className="error-banner">{error}</p> : null}
        <button type="submit" className="primary-button" disabled={isSubmitting || !password.trim()}>
          {isSubmitting ? "Checking..." : "Enter"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
