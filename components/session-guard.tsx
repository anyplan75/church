"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/account-actions";
import { readDb, updateDb } from "@/lib/app-db";
import { useChurch } from "@/components/church-state";
import { cleanPath } from "@/lib/page-path";
import { noteVisit, screenLabel } from "@/lib/simple";

const IDLE_MS = 10 * 60 * 1000;

export function SessionGuard() {
  const { ready, user } = useChurch();
  const pathname = usePathname();
  const noted = useRef("");

  useEffect(() => {
    if (!ready || !user?.churchId) return;
    const screen = screenLabel(cleanPath(pathname || "/"));
    if (!screen) return;
    const key = `${user.email}:${screen}`;
    if (noted.current === key) return;
    noted.current = key;
    const current = readDb();
    const next = noteVisit(current.visits ?? [], user.email, screen);
    if (JSON.stringify(next) === JSON.stringify(current.visits ?? [])) return;
    updateDb((db) => {
      db.visits = next;
    });
  }, [ready, user, pathname]);

  useEffect(() => {
    if (!ready || !user || user.kind === "platform") return;
    let timer = window.setTimeout(() => leave(), IDLE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => leave(), IDLE_MS);
    };
    const events = ["pointerdown", "keydown", "input"] as const;
    for (const event of events) window.addEventListener(event, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const event of events) window.removeEventListener(event, reset);
    };
  }, [ready, user]);

  return null;
}

function leave() {
  void logout().catch((error: unknown) => {
    if (!(error instanceof Error) || error.message !== "NAV") throw error;
  });
}
