import type { DataResponse, ExploreResponse, Vote } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  getData: (page: number, pageSize = 100): Promise<DataResponse> =>
    request(`/api/data?page=${page}&page_size=${pageSize}`),

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
};
