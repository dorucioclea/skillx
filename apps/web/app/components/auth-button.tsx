import { signIn, signOut, useSession } from "~/lib/auth/auth-client";

export function AuthButton() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <button
        disabled
        className="rounded-lg bg-sx-bg-muted px-4 py-2 text-sm text-sx-fg-muted"
      >
        Loading...
      </button>
    );
  }

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-sx-fg-muted">
          {session.user.name || session.user.email}
        </span>
        <button
          onClick={() => signOut()}
          className="rounded-lg bg-sx-bg-muted px-4 py-2 text-sm text-sx-fg hover:bg-sx-bg-hover"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn.social({ provider: "github" })}
      className="rounded-lg bg-sx-accent px-4 py-2 text-sm text-white hover:bg-sx-accent-hover"
    >
      Sign In with GitHub
    </button>
  );
}
