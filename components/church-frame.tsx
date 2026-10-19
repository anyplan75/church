"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { SessionGuard } from "@/components/session-guard";
import { ReminderWatcher } from "@/components/reminder-watcher";
import { useChurch } from "@/components/church-state";
import {
  isMobileMemberApp,
  isMobileMemberPath,
  isMobileOperatorApp,
  isMobileOperatorPath,
  MOBILE_MEMBER_HOME,
  MOBILE_REMOTE_HOME,
} from "@/lib/mobile-app";
import { appNavigate } from "@/lib/mobile-nav";
import { cleanPath } from "@/lib/page-path";
import { rememberLanHost, restoreLanHost } from "@/lib/lan-link";
import { saveOutputHost } from "@/lib/output-host";
import { readOperatorService, startOperatorLink } from "@/lib/output-link";
import { can, canOpenPath, homeFor } from "@/lib/roles";

function landing(user: { kind: "platform" | "church"; churchId: string | null; roles: Parameters<typeof homeFor>[0] }) {
  if (isMobileMemberApp()) return MOBILE_MEMBER_HOME;
  if (isMobileOperatorApp()) return MOBILE_REMOTE_HOME;
  if (user.kind === "platform" && !user.churchId) return "/platform";
  return homeFor(user.roles);
}

function isMemberShellPath(path: string): boolean {
  return (
    path === "/member" ||
    path.startsWith("/member/") ||
    path === "/prayers" ||
    path === "/community" ||
    path.startsWith("/community/")
  );
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
    const go = (href: string) => appNavigate(href, router, "replace");
    if (!user) {
      if (path !== "/login") go("/login");
      return;
    }
    if (path === "/login" || path === "/setup") {
      go(landing(user));
      return;
    }
    if (isMobileMemberApp()) {
      if (!isMobileMemberPath(path)) {
        go(MOBILE_MEMBER_HOME);
        return;
      }
      return;
    }
    if (isMobileOperatorApp()) {
      // 패드는 슬라이드 리모컨만. 데스크톱 역할(진행 등)로 /remote 를 막지 않습니다.
      if (!isMobileOperatorPath(path)) {
        go(MOBILE_REMOTE_HOME);
        return;
      }
      return;
    }
    if (user.kind === "platform" && !user.churchId && path !== "/platform" && path !== "/activity") {
      go("/platform");
      return;
    }
    if (path === "/activity") {
      if (user.kind === "platform" || can(user.roles, "screen.activity")) return;
      go("/denied");
      return;
    }
    if (user.kind === "church" && path === "/platform") {
      go(homeFor(user.roles));
      return;
    }
    if (path === "/platform") return;
    if (!canOpenPath(user.roles, path)) go("/denied");
  }, [ready, user, pathname, router]);

  const path = cleanPath(pathname || "/");
  const output = isOutputPath(path) || isOutputPath(browserPath);
  if (!ready && !output) return <p className="page text-muted">불러오는 중</p>;
  // 로그인 전 children(성도 null·리모컨 대기)이 빈 화면/멈춤처럼 보이지 않게 가립니다.
  if (ready && !user && !output && path !== "/login") {
    return <p className="page text-muted">로그인으로 이동 중</p>;
  }

  return (
    <>
      {user && db && path !== "/platform" && !output && !isMobileOperatorApp() && !isMobileMemberApp() && !isMemberShellPath(path) ? (
        <Nav churchName={db.settings.churchName} email={user.email} roles={user.roles} platform={user.kind === "platform"} />
      ) : null}
      {user && !output && !isMobileOperatorApp() && !isMobileMemberApp() && can(user.roles, "screen.prepare") ? <ReminderWatcher /> : null}
      {user && !output ? <SessionGuard /> : null}
      {children}
    </>
  );
}
