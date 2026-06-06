"use client";

import { Button } from "@billtrack/ui";
import { useRef, useState } from "react";

type SubmitState =
  | { status: "idle"; message: string }
  | { status: "submitting"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function RegistrationForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: "",
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;

    if (!form) {
      setSubmitState({
        status: "error",
        message: "Could not read the registration form. Please try again.",
      });
      return;
    }

    setSubmitState({
      status: "submitting",
      message: "Submitting registration request...",
    });

    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") ?? ""),
      shopName: String(formData.get("shopName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      shopCategory: String(formData.get("shopCategory") ?? ""),
    };

    try {
      const response = await fetch(`${apiUrl}/registration-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(
          errorBody?.message ?? "Could not submit registration request.",
        );
      }

      form.reset();
      setSubmitState({
        status: "success",
        message: "Registration submitted. A superadmin can now review it.",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not submit registration request.",
      });
    }
  }

  return (
    <form ref={formRef} className="registration" onSubmit={handleSubmit}>
      <input name="name" placeholder="Owner name" required />
      <input name="shopName" placeholder="Shop name" required />
      <input name="email" placeholder="Email" required type="email" />
      <input name="phone" placeholder="Phone" required />
      <input name="shopCategory" placeholder="Shop category" required />
      <Button disabled={submitState.status === "submitting"} type="submit">
        Request shop approval
      </Button>
      {submitState.message ? (
        <p className={`form-message ${submitState.status}`}>
          {submitState.message}
        </p>
      ) : null}
    </form>
  );
}
