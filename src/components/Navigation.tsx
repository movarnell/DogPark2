import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { HumanType } from "../types/HumanType";

function getDisplayName(user: HumanType) {
  return user.fullName || user.human_name || user.username || user.email;
}

function getInitials(user: HumanType) {
  const displayName = getDisplayName(user);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || user.email[0]?.toUpperCase() || "U";
}

function UserAvatar({ user }: { user: HumanType }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = api.assetUrl(user.avatarUrl);

  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-900 text-xs font-black text-white">
      {imageUrl && !imageFailed ? (
        <img
          className="h-full w-full object-cover"
          src={imageUrl}
          alt={`${getDisplayName(user)} profile photo`}
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        getInitials(user)
      )}
    </span>
  );
}

function Navigation({
  signedInUser,
  setSignedInUser,
}: {
  signedInUser: HumanType | null;
  setSignedInUser: (user: HumanType | null) => void;
}) {
  const navigate = useNavigate();

  async function signOut() {
    await api.logout().catch(() => undefined);
    setSignedInUser(null);
    navigate("/");
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition ${
      isActive ? "bg-emerald-900 text-white" : "text-stone-700 hover:bg-stone-100"
    }`;
  const displayName = signedInUser ? getDisplayName(signedInUser) : "";

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between" aria-label="Primary navigation">
        <Link to="/" className="flex items-center gap-3" aria-label="Dog Park Meetup home">
          <img className="h-10 w-10 rounded-lg" src="/brand/dog-park-meetup-mark.svg" alt="" />
          <span>
            <span className="block text-base font-black tracking-tight">Dog Park Meetup</span>
            <span className="block text-xs font-medium text-stone-500">Plan visits. Find your local pack.</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <NavLink to="/parks" className={linkClass}>
            Parks
          </NavLink>
          {signedInUser && (
            <>
              <NavLink to="/community" className={linkClass}>
                Community
              </NavLink>
              <NavLink to="/messages" className={linkClass}>
                Messages
              </NavLink>
              <NavLink to="/account" className={linkClass}>
                Account
              </NavLink>
              {signedInUser.role === "admin" && (
                <NavLink to="/admin" className={linkClass}>
                  Moderation
                </NavLink>
              )}
            </>
          )}
          {!signedInUser ? (
            <NavLink to="/login" className={linkClass}>
              Sign in
            </NavLink>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex min-w-0 items-center gap-2 rounded-full border border-stone-200 bg-white py-1 pl-1 pr-3 shadow-sm">
                <UserAvatar user={signedInUser} />
                <span className="min-w-0 leading-tight">
                  <span className="block max-w-36 truncate text-sm font-bold text-stone-950">{displayName}</span>
                  <span className="block max-w-36 truncate text-xs font-medium text-stone-500">
                    @{signedInUser.username}
                  </span>
                </span>
              </span>
              <button
                className="rounded-full border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                type="button"
                aria-label={`Sign out ${displayName}`}
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

export default Navigation;
