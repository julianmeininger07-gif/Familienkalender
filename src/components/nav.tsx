"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string };

function useItems(isAdmin: boolean) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/", label: "Kalender", icon: "📅" },
    { href: "/einstellungen", label: "Einstellungen", icon: "⚙️" },
    ...(isAdmin ? [{ href: "/verwaltung", label: "Verwaltung", icon: "👥" }] : []),
  ];
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return { items, active };
}

/** Navigation oben, nur am Computer sichtbar. */
export function DesktopNav({ isAdmin }: { isAdmin: boolean }) {
  const { items, active } = useItems(isAdmin);
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
          </Link>
        ))}
      </nav>
    </>
  );
}

/**
 * Navigation unten, nur am Handy. Muss außerhalb des Headers stehen: dessen backdrop-blur
 * würde "fixed" sonst auf den Header statt aufs Fenster beziehen.
 */
export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const { items, active } = useItems(isAdmin);
  return (
    <>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-200 bg-white md:hidden">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${active(i.href) ? "font-semibold text-gray-900" : "text-gray-500"}`}
          >
            <span aria-hidden className="text-lg leading-none">
              {i.icon}
            </span>
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
