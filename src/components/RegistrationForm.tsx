import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { HumanType } from "../types/HumanType";

function RegistrationForm({ setSignedInUser }: { setSignedInUser: (user: HumanType) => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      const user = await api.register({ fullName, email, username, password });
      setSignedInUser(user);
      navigate("/ManageDogs");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Registration failed");
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl place-items-center px-4 py-8">
      <form onSubmit={handleRegister} className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Join the community</p>
        <h1 className="mt-1 text-3xl font-black">Create account</h1>
        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
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
        <input className="mt-5 w-full rounded-md border border-stone-300 px-3 py-2" placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        <input className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        <input className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
        <input className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} />
        <button type="submit" className="mt-6 w-full rounded-md bg-emerald-900 px-4 py-3 font-bold text-white">
          Create account
        </button>
      </form>
    </main>
  );
}

export default RegistrationForm;
