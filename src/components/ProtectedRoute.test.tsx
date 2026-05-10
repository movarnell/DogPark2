import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ProtectedRoute from "./ProtectedRoute";
import { HumanType } from "../types/HumanType";

const user: HumanType = {
  id: "42",
  email: "owner@example.com",
  username: "owner",
  role: "member",
};

function renderProtectedRoute(signedInUser: HumanType | null) {
  render(
    <MemoryRouter initialEntries={["/account"]}>
      <Routes>
        <Route
          path="/account"
          element={
            <ProtectedRoute user={signedInUser}>
              <h1>Private account</h1>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<h1>Login page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects anonymous visitors to login", () => {
    renderProtectedRoute(null);

    expect(screen.getByRole("heading", { name: "Login page" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Private account" })).not.toBeInTheDocument();
  });

  it("renders protected content for signed-in users", () => {
    renderProtectedRoute(user);

    expect(screen.getByRole("heading", { name: "Private account" })).toBeInTheDocument();
  });
});
