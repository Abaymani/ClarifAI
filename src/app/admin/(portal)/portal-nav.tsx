"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/overview", label: "Översikt" },
  { href: "/admin/agreement", label: "Överensstämmelse" },
  { href: "/admin/development", label: "Utveckling" },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Forskarportalen" className="flex items-center gap-1">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname.startsWith(link.href) ? "page" : undefined}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
