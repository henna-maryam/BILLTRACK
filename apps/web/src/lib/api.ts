export const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("billtrack_token");
}

export function setStoredToken(token: string): void {
  window.localStorage.setItem("billtrack_token", token);
}

export function clearStoredToken(): void {
  window.localStorage.removeItem("billtrack_token");
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message ?? body?.error ?? "Request failed.");
  }

  return body as T;
}
