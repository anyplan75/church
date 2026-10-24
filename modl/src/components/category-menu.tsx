"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { NavIcon } from "@/components/nav-icons";
import type { PlaceMenuItem } from "@/promo/rules";
import { CATEGORY_MENUS } from "@/theme/categories";

function active(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type MenuLink = { href: string; label: string; icon: string };

function menuGroups(menuHrefs: readonly string[], placeMenus: readonly PlaceMenuItem[]) {
  const allowed = new Set(menuHrefs);
  return CATEGORY_MENUS.map((group) => {
    const items: MenuLink[] = group.items
      .filter((item) => allowed.has(item.href))
      .map((item) => ({ href: item.href, label: item.label, icon: item.href }));
    if (group.label !== "연결") return { label: group.label, items };
    const places = placeMenus.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.kind === "church" ? "church-menu" : "gathering-menu",
    }));
    return { label: group.label, items: [...places, ...items] };
  }).filter((group) => group.items.length > 0);
}

export function CategoryMenu({
  menuHrefs,
  placeMenus = [],
  onNavigate,
  className = "",
}: {
  menuHrefs: readonly string[];
  placeMenus?: readonly PlaceMenuItem[];
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const groups = menuGroups(menuHrefs, placeMenus);
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
                    <NavIcon name={item.icon} />
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

/** 한 줄에 들어가는 칸 수입니다. 글자보다 좁아지면 같은 너비로 다음 줄에 이어 넣습니다. */
function useEqualColumns(labels: readonly string[]) {
  const ref = useRef<HTMLDivElement>(null);
  const key = labels.join("\n");
  const [columns, setColumns] = useState(Math.max(1, labels.length));
  useLayoutEffect(() => {
    const node = ref.current;
    const names = key.length === 0 ? [] : key.split("\n");
    if (!node || names.length === 0) return;
    const measure = () => {
      const width = node.clientWidth;
      if (width <= 0) return;
      const style = getComputedStyle(node);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (context) context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const longest = names.reduce((max, label) => {
        const text = context ? context.measureText(label).width : label.length * 16;
        return Math.max(max, text);
      }, 0);
      const minCell = Math.ceil(longest + 16);
      const fit = Math.max(1, Math.min(names.length, Math.floor(width / Math.max(minCell, 1))));
      setColumns(fit);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [key]);
  return { ref, columns };
}

function phoneTabClass(current: boolean) {
  return `flex min-h-12 w-full items-center justify-center border-b border-r border-[#e2e8f0] px-1 text-center text-base font-semibold leading-tight ${
    current ? "bg-[#1e293b] text-white" : "bg-white text-[#334155]"
  }`;
}

/** 폰 위쪽 두 줄입니다. 첫 줄은 구역, 둘째 줄은 그 구역의 메뉴입니다. 각 줄은 화면 너비를 칸 수로 나눕니다. */
export function PhoneCategoryTabs({
  menuHrefs,
  placeMenus = [],
}: {
  menuHrefs: readonly string[];
  placeMenus?: readonly PlaceMenuItem[];
}) {
  const pathname = usePathname();
  const groups = menuGroups(menuHrefs, placeMenus);
  const pathGroup = groups.find((group) => group.items.some((item) => active(pathname, item.href)))?.label;
  const [override, setOverride] = useState<{ path: string; label: string } | null>(null);
  const selectedLabel = override?.path === pathname ? override.label : (pathGroup ?? groups[0]?.label ?? "");
  const selected = groups.find((group) => group.label === selectedLabel) ?? groups[0];
  const zoneLabels = groups.map((group) => group.label);
  const itemLabels = selected?.items.map((item) => item.label) ?? [];
  const zones = useEqualColumns(zoneLabels);
  const items = useEqualColumns(itemLabels);
  if (!selected) return null;

  return (
    <div className="grid w-full">
      <div
        ref={zones.ref}
        role="tablist"
        aria-label="구역"
        className="grid w-full text-base"
        style={{ gridTemplateColumns: `repeat(${zones.columns}, minmax(0, 1fr))` }}
      >
        {groups.map((group) => {
          const current = group.label === selected.label;
          return (
            <button
              key={group.label}
              type="button"
              role="tab"
              aria-selected={current}
              className={phoneTabClass(current)}
              onClick={() => setOverride({ path: pathname, label: group.label })}
            >
              {group.label}
            </button>
          );
        })}
      </div>
      <div
        ref={items.ref}
        role="tablist"
        aria-label={selected.label}
        className="grid w-full text-base"
        style={{ gridTemplateColumns: `repeat(${items.columns}, minmax(0, 1fr))` }}
      >
        {selected.items.map((item) => {
          const current = active(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} role="tab" aria-selected={current} className={phoneTabClass(current)}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
