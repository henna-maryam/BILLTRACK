"use client";

import { Button } from "@billtrack/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, setStoredToken } from "../../lib/api";

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("Signing in...");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await apiFetch<{ token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
        }),
      });
      setStoredToken(response.token);
      router.push("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="registration" onSubmit={handleSubmit}>
      <input name="email" placeholder="Email" required type="email" />
      <input name="password" placeholder="Password" required type="password" />
      <Button disabled={isSubmitting} type="submit">
        Sign in
      </Button>
      {message ? <p className="form-message submitting">{message}</p> : null}
    </form>
  );
}
