import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Nav } from "@/components/nav";
import { ReminderWatcher } from "@/components/reminder-watcher";
import { hasAnyAccount } from "@/lib/accounts";
import { can, canOpenPath, homeFor } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";
import { readDb } from "@/lib/store";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "예배 운영",
  description: "예배 전에 순서를 점검하고, 주보로 한 주를 준비한 뒤 예배 화면에 송출합니다.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const pathname = (await headers()).get("x-pathname") ?? "/";
  const setupOpen = !hasAnyAccount();
  const user = setupOpen ? null : await getCurrentUser();

  if (setupOpen) {
    if (pathname !== "/setup") redirect("/setup");
  } else if (!user) {
    if (pathname !== "/login") redirect("/login");
  } else if (pathname === "/login" || pathname === "/setup") {
    redirect(homeFor(user.roles));
  } else if (!canOpenPath(user.roles, pathname)) {
    redirect("/denied");
  }

  const churchName = user ? readDb().settings.churchName : "";

  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {user ? <Nav churchName={churchName} email={user.email} roles={user.roles} /> : null}
        {user && can(user.roles, "screen.prepare") ? <ReminderWatcher /> : null}
        {children}
      </body>
    </html>
  );
}
