"use client";

import { Button } from "@billtrack/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiFetch, setStoredToken } from "../../lib/api";

type SubmitState = {
  status: "idle" | "submitting" | "success" | "error";
  message: string;
};

export function ActivationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<SubmitState>({
    status: "idle",
    message: "",
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");

    setState({
      status: "submitting",
      message: "Activating your shop...",
    });

    try {
      const response = await apiFetch<{ token: string }>(
        "/activation/complete",
        {
          method: "POST",
          body: JSON.stringify({ token, password }),
        },
      );
      setStoredToken(response.token);
      setState({
        status: "success",
        message: "Shop activated. Opening your dashboard...",
      });
      router.push("/dashboard");
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Could not activate shop.",
      });
    }
  }

  return (
    <form className="registration" onSubmit={handleSubmit}>
      <input name="token" readOnly value={token ? "Activation token found" : ""} />
      <input
        minLength={8}
        name="password"
        placeholder="Create password"
        required
        type="password"
      />
      <Button disabled={state.status === "submitting"} type="submit">
        Activate shop
      </Button>
      {state.message ? (
        <p className={`form-message ${state.status}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
