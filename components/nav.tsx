"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/account-actions";
import { can, homeFor, type Capability, type Role } from "@/lib/roles";

const LINKS: { href: string; label: string; capability: Capability }[] = [
  { href: "/", label: "이번 주", capability: "screen.week" },
  { href: "/prepare", label: "준비", capability: "screen.prepare" },
  { href: "/services", label: "예배", capability: "screen.services" },
  { href: "/people", label: "사람", capability: "screen.people" },
  { href: "/songs", label: "찬양", capability: "screen.songs" },
  { href: "/settings", label: "설정", capability: "screen.settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ churchName, email, roles }: { churchName: string; email: string; roles: Role[] }) {
  const pathname = usePathname();
  if (pathname.endsWith("/live") || pathname.endsWith("/output")) return null;
  const links = LINKS.filter((link) => can(roles, link.capability));

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-card/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={homeFor(roles)} className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-serif text-xl text-pine">{churchName}</span>
          <span className="shrink-0 text-xs text-muted">예배 운영</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex items-center gap-1 text-sm" aria-label="주 메뉴">
            {links.map((link) => {
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
          <span className="max-w-44 truncate text-xs text-muted" title={email}>
            {email}
          </span>
          <form action={logout}>
            <button type="submit" className="btn btn-quiet btn-small">
              나가기
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
