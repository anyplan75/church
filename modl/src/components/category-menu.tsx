"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
        <section key={group.label} className="grid gap-0.5" aria-label={group.label}>
          <h2 className="px-3 pb-1 pt-4 text-[11px] font-medium leading-4 text-[#94a3b8]">{group.label}</h2>
          <ul className="grid list-none">
            {group.items.map((item) => {
              const current = active(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    onClick={onNavigate}
                    className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium leading-5 ${
                      current ? "bg-[#f1f5f9] text-[#1e293b]" : "text-[#475569] hover:bg-[#f8fafc]"
                    }`}
                  >
                    <NavIcon name={item.href} />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** 폰 위쪽 두 줄입니다. 첫 줄은 구역, 둘째 줄은 그 구역의 메뉴입니다. */
export function PhoneCategoryTabs({ menuHrefs }: { menuHrefs: readonly string[] }) {
  const pathname = usePathname();
  const allowed = new Set(menuHrefs);
  const groups = CATEGORY_MENUS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowed.has(item.href)),
  })).filter((group) => group.items.length > 0);
  const pathGroup = groups.find((group) => group.items.some((item) => active(pathname, item.href)))?.label;
  const [override, setOverride] = useState<{ path: string; label: string } | null>(null);
  const selectedLabel = override?.path === pathname ? override.label : (pathGroup ?? groups[0]?.label ?? "");
  const selected = groups.find((group) => group.label === selectedLabel) ?? groups[0];
  if (!selected) return null;

  return (
    <div className="grid gap-1 px-2 pb-2">
      <div role="tablist" aria-label="구역" className="flex gap-1 overflow-x-auto">
        {groups.map((group) => {
          const current = group.label === selected.label;
          return (
            <button
              key={group.label}
              type="button"
              role="tab"
              aria-selected={current}
              className={`h-9 shrink-0 rounded-full px-3 text-sm font-medium leading-5 ${
                current ? "bg-[#1e293b] text-white" : "bg-[#f8fafc] text-[#475569]"
              }`}
              onClick={() => setOverride({ path: pathname, label: group.label })}
            >
              {group.label}
            </button>
          );
        })}
      </div>
      <div role="tablist" aria-label={selected.label} className="flex gap-1">
        {selected.items.map((item) => {
          const current = active(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              role="tab"
              aria-selected={current}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-2 text-sm font-medium leading-5 ${
                current ? "bg-[#f1f5f9] text-[#1e293b]" : "text-[#475569]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
