import type { DataResponse, ExploreResponse, Vote } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  getData: (page: number, pageSize = 100, filter = "all", search = "", sortCol = "", sortDir = "asc"): Promise<DataResponse> =>
    request(`/api/data?page=${page}&page_size=${pageSize}&filter=${filter}&search=${encodeURIComponent(search)}&sort_col=${sortCol}&sort_dir=${sortDir}`),

  getVotes: (): Promise<Vote[]> => request("/api/votes"),

  putVote: (vote: Vote): Promise<void> =>
    request("/api/votes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vote),
    }),

  deleteVote: (vote: Omit<Vote, "vote">): Promise<void> =>
    request("/api/votes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vote),
    }),

  getExplore: (source: string, target: string): Promise<ExploreResponse> =>
    request(`/api/explore?source=${source}&target=${target}`),

  exportVotes: async (): Promise<void> => {
    const res = await fetch("/api/votes/export");
    if (!res.ok) throw new Error("Export failed");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? "votes.json";
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  importVotes: async (file: File): Promise<{ imported: number }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/votes/import", { method: "POST", body: form });
    if (!res.ok) throw new Error(`Import failed: ${await res.text()}`);
    return res.json() as Promise<{ imported: number }>;
  },
};
