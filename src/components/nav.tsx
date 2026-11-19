"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string; badge?: number };

function useItems(isAdmin: boolean, invites: number) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/", label: "Kalender", icon: "📅" },
    { href: "/einladungen", label: "Einladungen", icon: "✉️", badge: invites },
    { href: "/einstellungen", label: "Einstellungen", icon: "⚙️" },
    ...(isAdmin ? [{ href: "/verwaltung", label: "Verwaltung", icon: "👥" }] : []),
  ];
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return { items, active };
}

/** Navigation oben, nur am Computer sichtbar. */
export function DesktopNav({ isAdmin, invites }: { isAdmin: boolean; invites: number }) {
  const { items, active } = useItems(isAdmin, invites);
  return (
    <>
      <nav className="hidden gap-1 md:flex">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active(i.href) ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}
          >
            {i.label}
            {!!i.badge && <Badge n={i.badge} />}
          </Link>
        ))}
      </nav>
    </>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-feiertag px-1.5 text-xs font-bold text-white">
      {n}
    </span>
  );
}

/**
 * Navigation unten, nur am Handy. Muss außerhalb des Headers stehen: dessen backdrop-blur
 * würde "fixed" sonst auf den Header statt aufs Fenster beziehen.
 */
export function MobileNav({ isAdmin, invites }: { isAdmin: boolean; invites: number }) {
  const { items, active } = useItems(isAdmin, invites);
  return (
    <>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-200 bg-white md:hidden">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${active(i.href) ? "font-semibold text-gray-900" : "text-gray-500"}`}
          >
            <span aria-hidden className="relative text-lg leading-none">
              {i.icon}
              {!!i.badge && (
                <span className="absolute -top-1 -right-3 min-w-4 rounded-full bg-feiertag px-1 text-[10px] font-bold leading-4 text-white">
                  {i.badge}
                </span>
              )}
            </span>
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
