import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { api } from "./lib/api";

vi.mock("./lib/api", () => ({
  api: {
    me: vi.fn(),
  },
}));

vi.mock("./components/Navigation", () => ({
  default: () => <nav>Dog Park Navigation</nav>,
}));
vi.mock("./components/Home", () => ({
  default: () => <main>Home screen</main>,
}));
vi.mock("./components/Parks", () => ({
  default: () => <main>Parks screen</main>,
}));
vi.mock("./components/ParkDetail", () => ({
  default: () => <main>Park detail</main>,
}));
vi.mock("./components/SignInForm", () => ({
  default: () => <main>Login screen</main>,
}));
vi.mock("./components/RegistrationForm", () => ({
  default: () => <main>Register screen</main>,
}));
vi.mock("./components/Account", () => ({
  default: () => <main>Account screen</main>,
}));
vi.mock("./components/Community", () => ({
  default: () => <main>Community screen</main>,
}));
vi.mock("./components/Messages", () => ({
  default: () => <main>Messages screen</main>,
}));
vi.mock("./components/Moderation", () => ({
  default: () => <main>Moderation screen</main>,
}));

const meMock = vi.mocked(api.me);

function renderApp(path = "/") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App auth bootstrap", () => {
  beforeEach(() => {
    meMock.mockReset();
  });

  it("shows the loading state while the current session is being checked", () => {
    meMock.mockReturnValue(new Promise(() => {}));

    renderApp();

    expect(screen.getByText("Loading Dog Park Meetup")).toBeInTheDocument();
  });

  it("renders the app shell after an anonymous auth check", async () => {
    meMock.mockRejectedValue(new Error("Not signed in"));

    renderApp();

    await waitFor(() => expect(screen.getByText("Dog Park Navigation")).toBeInTheDocument());
    expect(screen.getByText("Home screen")).toBeInTheDocument();
  });

  it("allows signed-in users into protected routes after restore", async () => {
    meMock.mockResolvedValue({
      id: "42",
      email: "owner@example.com",
      username: "owner",
      role: "member",
    });

    renderApp("/account");

    await waitFor(() => expect(screen.getByText("Account screen")).toBeInTheDocument());
  });
});
