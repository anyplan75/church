"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Nav } from "@/components/nav";
import { ReminderWatcher } from "@/components/reminder-watcher";
import { useChurch } from "@/components/church-state";
import { cleanPath } from "@/lib/page-path";
import { can, canOpenPath, homeFor } from "@/lib/roles";

function landing(user: { kind: "platform" | "church"; churchId: string | null; roles: Parameters<typeof homeFor>[0] }) {
  if (user.kind === "platform" && !user.churchId) return "/platform";
  return homeFor(user.roles);
}

export function ChurchFrame({ children }: { children: React.ReactNode }) {
  const { ready, user, db } = useChurch();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const path = cleanPath(window.location.pathname || pathname || "/");
    if (!user) {
      if (path !== "/login") router.replace("/login");
      return;
    }
    if (path === "/login" || path === "/setup") {
      router.replace(landing(user));
      return;
    }
    if (user.kind === "platform" && !user.churchId && path !== "/platform") {
      router.replace("/platform");
      return;
    }
    if (user.kind === "church" && path === "/platform") {
      router.replace(homeFor(user.roles));
      return;
    }
    if (path === "/platform") return;
    if (!canOpenPath(user.roles, path)) router.replace("/denied");
  }, [ready, user, pathname, router]);

  if (!ready) return <p className="page text-muted">불러오는 중</p>;
  const path = cleanPath(pathname || "/");

  return (
    <>
      {user && db && path !== "/platform" ? (
        <Nav churchName={db.settings.churchName} email={user.email} roles={user.roles} platform={user.kind === "platform"} />
      ) : null}
      {user && can(user.roles, "screen.prepare") ? <ReminderWatcher /> : null}
      {children}
    </>
  );
}
