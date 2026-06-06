"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ActionState =
  | { status: "idle"; message: string; activationUrl?: string }
  | { status: "loading"; message: string; activationUrl?: string }
  | { status: "success"; message: string; activationUrl?: string }
  | { status: "error"; message: string; activationUrl?: string };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type RequestActionsProps = {
  shopId: string;
};

export function RequestActions({ shopId }: RequestActionsProps) {
  const router = useRouter();
  const [actionState, setActionState] = useState<ActionState>({
    status: "idle",
    message: "",
  });

  async function runAction(action: "approve" | "reject") {
    setActionState({
      status: "loading",
      message: action === "approve" ? "Approving..." : "Rejecting...",
    });

    try {
      const response = await fetch(
        `${apiUrl}/admin/registration-requests/${shopId}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message ?? `Could not ${action} request.`);
      }

      setActionState({
        status: "success",
        message:
          action === "approve"
            ? "Approved. Activation link created for development."
            : "Rejected.",
        activationUrl: body?.activation?.url,
      });

      if (action === "reject") {
        router.refresh();
      }
    } catch (error) {
      setActionState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : `Could not ${action} request.`,
      });
    }
  }

  return (
    <div className="request-actions">
      <div className="action-buttons">
        <button
          disabled={actionState.status === "loading"}
          onClick={() => void runAction("approve")}
          type="button"
        >
          Approve
        </button>
        <button
          className="secondary"
          disabled={actionState.status === "loading"}
          onClick={() => void runAction("reject")}
          type="button"
        >
          Reject
        </button>
      </div>

      {actionState.message ? (
        <p className={`action-message ${actionState.status}`}>
          {actionState.message}
        </p>
      ) : null}

      {actionState.activationUrl ? (
        <div className="activation-link">
          <span>Activation link</span>
          <code>{actionState.activationUrl}</code>
        </div>
      ) : null}
    </div>
  );
}
