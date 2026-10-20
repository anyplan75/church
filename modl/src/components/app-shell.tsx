"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CategoryMenu } from "@/components/category-menu";
import { NavIcon } from "@/components/nav-icons";
import { TermText } from "@/components/term-text";
import { useMenuShortcuts } from "@/components/use-menu-shortcuts";

/** 좁은 화면은 아래 탭, 넓은 화면은 왼쪽 메뉴입니다. */
export function AppShell({
  children,
  accountName,
}: {
  children: React.ReactNode;
  accountName: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const go = useCallback((href: string) => router.push(href), [router]);
  useMenuShortcuts(go);
  const home = pathname === "/";
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div className="flex min-h-dvh flex-col bg-[#f8fafc] text-[#1e293b] md:flex-row">
      <a
        href="#modl-main"
        className="sr-only rounded-xl bg-white px-3 py-2 focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-20"
      >
        본문으로
      </a>
      <aside className="hidden w-60 shrink-0 flex-col border-[#e2e8f0] bg-white md:sticky md:top-0 md:flex md:h-dvh md:border-r">
        <div className="px-5 pb-1 pt-5">
          <Link href="/" className="block px-1 py-1" aria-current={home ? "page" : undefined}>
            <span className="block text-[1.35rem] font-bold leading-none tracking-[-0.04em] text-[#0f172a]">모들</span>
          </Link>
        </div>
        <nav aria-label="분류" className="flex min-h-0 flex-1 flex-col px-2 pb-2">
          <CategoryMenu className="min-h-0 flex-1 overflow-y-auto" />
          <div className="mt-2 border-t border-[#e2e8f0] pt-2">
            <AccountLink accountName={accountName} />
          </div>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b border-[#e2e8f0] bg-white px-3 md:hidden">
          <Link href="/" className="min-w-0 text-base font-bold tracking-[-0.03em] text-[#0f172a]" aria-current={home ? "page" : undefined}>
            모들
          </Link>
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-md px-3 text-sm font-medium text-[#475569]"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            분류
          </button>
        </header>
        {menuOpen ? (
          <nav aria-label="분류" className="max-h-[70vh] overflow-y-auto border-b border-[#e2e8f0] bg-white px-2 py-2 md:hidden">
            <CategoryMenu onNavigate={closeMenu} />
            <div className="mt-2 border-t border-[#e2e8f0] pt-2">
              <AccountLink accountName={accountName} />
            </div>
          </nav>
        ) : null}
        <main id="modl-main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function AccountLink({ accountName, className = "" }: { accountName: string | null; className?: string }) {
  return (
    <Link href="/account" className={`flex h-11 min-w-0 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#475569] ${className}`}>
      <NavIcon name="account" />
      {accountName ? (
        <span className="min-w-0 truncate">{accountName}</span>
      ) : (
        <TermText termKey="account" />
      )}
    </Link>
  );
}
