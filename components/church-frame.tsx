"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Nav } from "@/components/nav";
import { ReminderWatcher } from "@/components/reminder-watcher";
import { useChurch } from "@/components/church-state";
import { cleanPath } from "@/lib/page-path";
import { can, canOpenPath, homeFor } from "@/lib/roles";

export function ChurchFrame({ children }: { children: React.ReactNode }) {
  const { ready, user, db } = useChurch();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const path = cleanPath(window.location.pathname || pathname || "/");
    if (!user) {
      if (path !== "/login" && path !== "/setup") router.replace("/login");
      return;
    }
    if (path === "/login" || path === "/setup") {
      router.replace(homeFor(user.roles));
      return;
    }
    if (!canOpenPath(user.roles, path)) router.replace("/denied");
  }, [ready, user, pathname, router]);

  if (!ready) return <p className="page text-muted">불러오는 중</p>;

  return (
    <>
      {user && db ? <Nav churchName={db.settings.churchName} email={user.email} roles={user.roles} /> : null}
      {user && can(user.roles, "screen.prepare") ? <ReminderWatcher /> : null}
      {children}
    </>
  );
}
