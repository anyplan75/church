"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCommunityTerm } from "@/components/use-community-term";
import { MENU_ITEMS } from "@/theme/menus";
import type { MenuKey } from "@/theme/dictionary";

function MenuLink({ menuKey }: { menuKey: MenuKey }) {
  const pathname = usePathname();
  const term = useCommunityTerm(menuKey);
  const href = `/${menuKey}`;
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block min-w-0 shrink-0 rounded-2xl px-3 py-2 leading-snug ${
        active ? "bg-[#1d6b45] text-white" : "text-[#241c16] hover:bg-[#f0e6d6]"
      }`}
    >
      <span className="nav-label font-semibold">{term.primary}</span>
    </Link>
  );
}

export function MenuList({ className }: { className?: string }) {
  return (
    <div className={className}>
      {MENU_ITEMS.map((item) => (
        <MenuLink key={item.key} menuKey={item.key} />
      ))}
    </div>
  );
}
