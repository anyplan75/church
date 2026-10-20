"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CategoryMenu } from "@/components/category-menu";
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
    <div className="flex min-h-dvh flex-col bg-[#f3f4f6] text-[#111827] md:flex-row">
      <a
        href="#modl-main"
        className="sr-only rounded-xl bg-white px-3 py-2 focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-20"
      >
        본문으로
      </a>
      <aside className="hidden w-[clamp(15rem,24vw,20rem)] shrink-0 flex-col border-[#e5e7eb] bg-white md:sticky md:top-0 md:flex md:h-dvh md:overflow-y-auto md:border-r">
        <div className="px-4 py-5">
          <Link href="/" className="block rounded-xl px-2 py-1" aria-current={home ? "page" : undefined}>
            <span className="block text-[clamp(1.4rem,1.1rem+0.6vw,1.8rem)] font-semibold leading-tight">모들</span>
          </Link>
        </div>
        <nav aria-label="분류" className="flex min-h-0 flex-1 flex-col gap-1 px-3 pb-6">
          <CategoryMenu className="min-h-0 flex-1" />
          <AccountLink accountName={accountName} className="mt-4" />
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-[#e5e7eb] bg-white px-4 py-3 md:hidden">
          <Link href="/" className="min-w-0 font-semibold leading-tight" aria-current={home ? "page" : undefined}>
            모들
          </Link>
          <button
            type="button"
            className="rounded-xl px-3 py-2 font-semibold"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            분류
          </button>
          <AccountLink accountName={accountName} />
        </header>
        {menuOpen ? (
          <nav aria-label="분류" className="border-b border-[#e5e7eb] bg-white px-3 py-4 md:hidden">
            <CategoryMenu onNavigate={closeMenu} />
          </nav>
        ) : null}
        <main id="modl-main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function AccountLink({ accountName, className = "" }: { accountName: string | null; className?: string }) {
  return (
    <Link href="/account" className={`block min-w-0 max-w-full rounded-xl px-2 py-2 leading-snug ${className}`}>
      {accountName ? (
        <span className="block break-words font-semibold">{accountName}</span>
      ) : (
        <TermText termKey="account" />
      )}
    </Link>
  );
}
