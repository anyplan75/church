"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "이번 주" },
  { href: "/prepare", label: "준비" },
  { href: "/services", label: "예배" },
  { href: "/people", label: "사람" },
  { href: "/songs", label: "찬양" },
  { href: "/settings", label: "설정" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ churchName }: { churchName: string }) {
  const pathname = usePathname();
  if (pathname.endsWith("/live") || pathname.endsWith("/output")) return null;

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-card/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-serif text-xl text-pine">{churchName}</span>
          <span className="shrink-0 text-xs text-muted">예배 운영</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm" aria-label="주 메뉴">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 ${active ? "bg-pine-soft font-semibold text-pine" : "text-muted hover:text-ink"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
