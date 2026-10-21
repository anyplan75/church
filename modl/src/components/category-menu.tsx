"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icons";
import { CATEGORY_MENUS } from "@/theme/categories";

function active(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CategoryMenu({
  menuHrefs,
  onNavigate,
  className = "",
}: {
  menuHrefs: readonly string[];
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const allowed = new Set(menuHrefs);
  const groups = CATEGORY_MENUS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowed.has(item.href)),
  })).filter((group) => group.items.length > 0);
  return (
    <div className={`grid content-start gap-1 ${className}`}>
      {groups.map((group) => (
        <section key={group.label} className="grid gap-1">
          <h2 className="px-3 pb-1 pt-4 text-[11px] font-medium leading-4 text-[#94a3b8]">{group.label}</h2>
          <div role="tablist" aria-label={group.label} className="flex flex-wrap gap-1 px-2">
            {group.items.map((item) => {
              const current = active(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="tab"
                  aria-selected={current}
                  onClick={onNavigate}
                  className={`inline-flex h-9 max-w-full items-center gap-1.5 rounded-full px-2.5 text-sm font-medium leading-5 ${
                    current ? "bg-[#f1f5f9] text-[#1e293b]" : "text-[#475569] hover:bg-[#f8fafc]"
                  }`}
                >
                  <NavIcon name={item.href} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
