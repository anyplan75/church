"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORY_MENUS } from "@/theme/categories";

function active(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CategoryMenu({ onNavigate, className = "" }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  return (
    <div className={`grid gap-4 ${className}`}>
      {CATEGORY_MENUS.map((group) => (
        <section key={group.label} className="grid gap-1" aria-label={group.label}>
          <h2 className="px-3 text-sm font-semibold leading-snug text-[#6b7280]">{group.label}</h2>
          <ul className="grid list-none gap-1">
            {group.items.map((item) => {
              const current = active(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    onClick={onNavigate}
                    className={`block rounded-xl px-3 py-2.5 font-semibold leading-snug ${
                      current ? "bg-[#111827] text-white" : "text-[#111827] hover:bg-[#f3f4f6]"
                    }`}
                  >
                    {item.label}
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
