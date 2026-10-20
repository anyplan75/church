"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icons";
import { CATEGORY_MENUS } from "@/theme/categories";

function active(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CategoryMenu({ onNavigate, className = "" }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  return (
    <div className={`grid content-start gap-1 ${className}`}>
      {CATEGORY_MENUS.map((group) => (
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
