import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("builds asset URLs from the configured API base", () => {
    expect(api.assetUrl()).toBe("");
    expect(api.assetUrl("https://cdn.example.com/dog.jpg")).toBe("https://cdn.example.com/dog.jpg");
    expect(api.assetUrl("/uploads/dog.jpg")).toBe("http://localhost:4050/uploads/dog.jpg");
    expect(api.assetUrl("uploads/dog.jpg")).toBe("http://localhost:4050/uploads/dog.jpg");
  });

  it("sends credentialed JSON requests", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "42",
        email: "owner@example.com",
        username: "owner",
      }),
    );

    await api.login({ email: "owner@example.com", password: "secret" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4050/api/owners/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "owner@example.com", password: "secret" }),
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });

  it("passes viewer dog ids through park and visit reads", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "park-1", name: "Oak Run" }));
    await api.getPark("park/with spaces", "dog-1");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost:4050/api/parks/park%2Fwith%20spaces?source=google&viewerDogId=dog-1",
      expect.any(Object),
    );

    fetchMock.mockResolvedValue(jsonResponse([]));
    await api.getVisits("park-1", "dog-1");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost:4050/api/visits?parkId=park-1&viewerDogId=dog-1",
      expect.any(Object),
    );
  });

  it("returns undefined for empty successful responses", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(api.logout()).resolves.toBeUndefined();
  });

  it("surfaces API error messages and falls back for non-JSON failures", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Invalid login" }, { status: 401 }));
    await expect(api.login({ email: "bad@example.com", password: "bad" })).rejects.toThrow("Invalid login");

    fetchMock.mockResolvedValueOnce(new Response("server down", { status: 500 }));
    await expect(api.me()).rejects.toThrow("Request failed");
  });
});
