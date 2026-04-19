// Standard JSON fetcher used by query hooks.
// - throws Error เมื่อ HTTP not ok (React Query จะถือเป็น error state)
// - parse JSON อัตโนมัติ
// - credentials: "include" — ใช้ cookie session

export async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      detail = j?.error ?? j?.message ?? "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    const err = new Error(detail || `HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
