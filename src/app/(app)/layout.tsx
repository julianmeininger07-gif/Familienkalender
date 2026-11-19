// Alle Seiten lesen die Datenbank, nichts davon darf beim Build vorgerendert werden.
export const dynamic = "force-dynamic";

import { logout } from "@/actions/auth";
import { DesktopNav, MobileNav } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { openInvitationCount } from "@/lib/invitations";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const invites = await openInvitationCount(user.id);
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2 font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ferien text-xs">27</span>
            Familienkalender
          </div>
          <div className="flex-1">
            <DesktopNav isAdmin={user.role === "admin"} invites={invites} />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: user.color }} />
              {user.name}
            </span>
            <form action={logout}>
              <button className="text-gray-500 hover:text-gray-900" type="submit">
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <MobileNav isAdmin={user.role === "admin"} invites={invites} />
    </div>
  );
}
