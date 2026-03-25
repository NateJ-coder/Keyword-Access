"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home" },
  { href: "/topics", label: "Topics" },
  { href: "/articles", label: "Articles" },
  { href: "/sources", label: "Sources" }
] as const;

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="nav-tabs" aria-label="Primary">
      {ITEMS.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link key={item.href} href={item.href} className={isActive ? "nav-link active" : "nav-link"}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}