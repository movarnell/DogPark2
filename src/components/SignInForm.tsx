import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { HumanType } from "../types/HumanType";

interface SignInFormProps {
  setSignedInUser: (user: HumanType) => void;
}

function SignInForm({ setSignedInUser }: SignInFormProps) {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authError = searchParams.get("error");
  const authErrorMessage =
    {
      google_not_configured: "Google sign-in is not configured yet.",
      apple_not_configured: "Apple sign-in is not configured yet.",
      invalid_google_state: "Google sign-in expired. Try again.",
      invalid_apple_state: "Apple sign-in expired. Try again.",
      google_failed: "Google sign-in could not be completed.",
      apple_failed: "Apple sign-in could not be completed.",
    }[authError || ""] || "Provider sign-in could not be completed.";

  async function signInUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const user = await api.login({ email, password });
      setSignedInUser(user);
      navigate("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to sign in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl place-items-center px-4 py-8">
      <form className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-sm" onSubmit={signInUser}>
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Welcome back</p>
        <h1 className="mt-1 text-3xl font-black">Sign in</h1>
        {(error || authError) && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">
            {error || authErrorMessage}
          </p>
        )}
        {api.appleSignInEnabled && (
          <a
            className="mt-5 flex w-full items-center justify-center gap-3 rounded-md bg-black px-4 py-3 font-bold text-white hover:bg-stone-800"
            href={api.appleSignInUrl}
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-sm text-black">A</span>
            Continue with Apple
          </a>
        )}
        <a
          className="mt-5 flex w-full items-center justify-center gap-3 rounded-md border border-stone-300 bg-white px-4 py-3 font-bold text-stone-900 hover:bg-stone-50"
          href={api.googleSignInUrl}
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-stone-100 text-sm">G</span>
          Continue with Google
        </a>
        <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-stone-400">
          <span className="h-px flex-1 bg-stone-200" />
          Email
          <span className="h-px flex-1 bg-stone-200" />
        </div>
        <label className="mt-5 block text-sm font-bold" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-emerald-800"
          required
        />
        <label className="mt-4 block text-sm font-bold" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-emerald-800"
          required
        />
        <button className="mt-6 w-full rounded-md bg-emerald-900 px-4 py-3 font-bold text-white" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        <Link to="/register" className="mt-4 block text-center text-sm font-bold text-emerald-900">
          New to Dog Park Social? Create an account
        </Link>
      </form>
    </main>
  );
}

export default SignInForm;
