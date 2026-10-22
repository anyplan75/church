"use client";

import { useEffect, useRef } from "react";
import { resolveMenuShortcut } from "@/components/menu-shortcuts";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * g 를 누른 뒤 1.2초 안에 메뉴 글자를 누르면 그 화면으로 갑니다.
 * 글을 쓰는 칸에서는 동작하지 않습니다.
 */
export function useMenuShortcuts(onNavigate: (href: string) => void, allowedHrefs: readonly string[]) {
  const navigateRef = useRef(onNavigate);
  const allowedRef = useRef(allowedHrefs);
  navigateRef.current = onNavigate;
  allowedRef.current = allowedHrefs;

  useEffect(() => {
    let armed = false;
    let timer = 0;

    function disarm() {
      armed = false;
      window.clearTimeout(timer);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (!armed) {
        if (event.key.toLowerCase() === "g") {
          armed = true;
          timer = window.setTimeout(disarm, 1200);
        }
        return;
      }

      const href = resolveMenuShortcut("g", event.key);
      disarm();
      if (!href) return;
      if (href !== "/" && !allowedRef.current.includes(href)) return;
      event.preventDefault();
      navigateRef.current(href);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      disarm();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
