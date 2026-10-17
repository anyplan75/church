"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { SessionGuard } from "@/components/session-guard";
import { ReminderWatcher } from "@/components/reminder-watcher";
import { useChurch } from "@/components/church-state";
import { isMobileOperatorApp, isMobileOperatorPath, MOBILE_REMOTE_HOME } from "@/lib/mobile-app";
import { cleanPath } from "@/lib/page-path";
import { rememberLanHost, restoreLanHost } from "@/lib/lan-link";
import { saveOutputHost } from "@/lib/output-host";
import { readOperatorService, startOperatorLink } from "@/lib/output-link";
import { can, canOpenPath, homeFor } from "@/lib/roles";

function landing(user: { kind: "platform" | "church"; churchId: string | null; roles: Parameters<typeof homeFor>[0] }) {
  if (isMobileOperatorApp()) return MOBILE_REMOTE_HOME;
  if (user.kind === "platform" && !user.churchId) return "/platform";
  return homeFor(user.roles);
}

function isOutputPath(path: string): boolean {
  const clean = cleanPath(path);
  return clean === "/receive" || /^\/services\/[^/]+\/output$/.test(clean);
}

export function ChurchFrame({ children }: { children: React.ReactNode }) {
  const { ready, user, db } = useChurch();
  const pathname = usePathname();
  const router = useRouter();
  const [browserPath, setBrowserPath] = useState("");

  useEffect(() => {
    setBrowserPath(cleanPath(window.location.pathname || ""));
  }, [pathname]);

  useEffect(() => {
    if (!ready || !db?.settings.outputHost) return;
    saveOutputHost(db.settings.outputHost);
    rememberLanHost(db.settings.outputHost);
  }, [ready, db?.settings.outputHost]);

  useEffect(() => {
    if (!ready || !user || isOutputPath(browserPath)) return;
    void restoreLanHost(db?.settings.outputHost);
  }, [ready, user?.id, browserPath, db?.settings.outputHost]);

  useEffect(() => {
    if (!ready || !user || !browserPath || isOutputPath(browserPath) || !db?.settings.outputHost) return;
    const id = readOperatorService();
    if (!id) return;
    return startOperatorLink(id);
  }, [ready, user?.id, browserPath, db?.settings.outputHost]);

  useEffect(() => {
    if (!ready) return;
    const path = cleanPath(window.location.pathname || pathname || "/");
    if (isOutputPath(path)) return;
    if (!user) {
      if (path !== "/login") router.replace("/login");
      return;
    }
    if (path === "/login" || path === "/setup") {
      router.replace(landing(user));
      return;
    }
    if (isMobileOperatorApp()) {
      if (!isMobileOperatorPath(path)) {
        router.replace(MOBILE_REMOTE_HOME);
        return;
      }
      if (path === MOBILE_REMOTE_HOME || /^\/services\/[^/]+\/live$/.test(path)) {
        if (!can(user.roles, "screen.live")) {
          router.replace("/denied");
          return;
        }
      }
      return;
    }
    if (user.kind === "platform" && !user.churchId && path !== "/platform" && path !== "/activity") {
      router.replace("/platform");
      return;
    }
    if (path === "/activity") {
      if (user.kind === "platform" || can(user.roles, "screen.activity")) return;
      router.replace("/denied");
      return;
    }
    if (user.kind === "church" && path === "/platform") {
      router.replace(homeFor(user.roles));
      return;
    }
    if (path === "/platform") return;
    if (!canOpenPath(user.roles, path)) router.replace("/denied");
  }, [ready, user, pathname, router]);

  const path = cleanPath(pathname || "/");
  const output = isOutputPath(path) || isOutputPath(browserPath);
  if (!ready && !output) return <p className="page text-muted">불러오는 중</p>;

  return (
    <>
      {user && db && path !== "/platform" && !output && !isMobileOperatorApp() ? (
        <Nav churchName={db.settings.churchName} email={user.email} roles={user.roles} platform={user.kind === "platform"} />
      ) : null}
      {user && !output && !isMobileOperatorApp() && can(user.roles, "screen.prepare") ? <ReminderWatcher /> : null}
      {user && !output ? <SessionGuard /> : null}
      {children}
    </>
  );
}
