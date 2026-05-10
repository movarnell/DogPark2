import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import Account from "./components/Account";
import Community from "./components/Community";
import Home from "./components/Home";
import Messages from "./components/Messages";
import Moderation from "./components/Moderation";
import Navigation from "./components/Navigation";
import ParkDetail from "./components/ParkDetail";
import Parks from "./components/Parks";
import ProtectedRoute from "./components/ProtectedRoute";
import RegistrationForm from "./components/RegistrationForm";
import SignInForm from "./components/SignInForm";
import { api } from "./lib/api";
import { HumanType } from "./types/HumanType";

function App() {
  const [signedInUser, setSignedInUser] = useState<HumanType | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(setSignedInUser)
      .catch(() => setSignedInUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-stone-50">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4">
          <div className="rounded-lg border border-stone-200 bg-white px-5 py-4 text-sm text-stone-700 shadow-sm">
            Loading Dog Park Social
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <Navigation signedInUser={signedInUser} setSignedInUser={setSignedInUser} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/parks" element={<Parks />} />
        <Route path="/parks/:parkId" element={<ParkDetail signedInUser={signedInUser} />} />
        <Route path="/login" element={<SignInForm setSignedInUser={setSignedInUser} />} />
        <Route path="/register" element={<RegistrationForm setSignedInUser={setSignedInUser} />} />
        <Route
          path="/ManageDogs"
          element={
            <ProtectedRoute user={signedInUser}>
              <Account signedInUser={signedInUser} setSignedInUser={setSignedInUser} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute user={signedInUser}>
              <Account signedInUser={signedInUser} setSignedInUser={setSignedInUser} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/community"
          element={
            <ProtectedRoute user={signedInUser}>
              <Community />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute user={signedInUser}>
              <Messages signedInUser={signedInUser} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute user={signedInUser}>
              <Moderation signedInUser={signedInUser} />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
