"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/account-actions";
import { backToChurches } from "@/lib/platform-actions";
import { isMobileOperatorApp, MOBILE_REMOTE_HOME } from "@/lib/mobile-app";
import { cleanPath } from "@/lib/page-path";
import { can, homeFor, type Capability, type Role } from "@/lib/roles";

const LINKS: { href: string; label: string; capability: Capability }[] = [
  { href: "/", label: "주보", capability: "screen.bulletin" },
  { href: "/member", label: "성도", capability: "screen.member" },
  { href: "/week", label: "이번 주", capability: "screen.week" },
  { href: "/services", label: "예배", capability: "screen.services" },
  { href: "/people", label: "사람", capability: "screen.people" },
  { href: "/library", label: "라이브러리", capability: "screen.songs" },
  { href: "/community", label: "커뮤니티", capability: "screen.community" },
  { href: "/prayers", label: "기도함", capability: "screen.prayers" },
  { href: "/settings", label: "설정", capability: "screen.settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({
  churchName,
  email,
  roles,
  platform = false,
}: {
  churchName: string;
  email: string;
  roles: Role[];
  platform?: boolean;
}) {
  const pathname = usePathname();
  const path = cleanPath(pathname || "/");
  if (path.endsWith("/live") || path.endsWith("/output") || path === MOBILE_REMOTE_HOME) return null;
  // iPhone·iPad 조작 앱은 슬라이드 리모컨만 쓰므로 주 메뉴를 숨깁니다.
  if (isMobileOperatorApp()) return null;
  const links = LINKS.filter((link) => can(roles, link.capability));

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-card/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={homeFor(roles)} className="min-w-0">
          <span className="block truncate font-serif text-xl text-pine">{churchName}</span>
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
                  className={`rounded-full px-3 py-2.5 text-base sm:py-1.5 sm:text-sm ${active ? "bg-pine-soft font-semibold text-pine" : "text-muted hover:text-ink"}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          {platform ? (
            <form action={backToChurches}>
              <button type="submit" className="btn btn-quiet btn-small">
                교회 목록
              </button>
            </form>
          ) : null}
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
