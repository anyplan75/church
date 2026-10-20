import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { CommunityTermProvider } from "@/components/community-term-provider";
import { loadShellState } from "@/server/community/service";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "모들",
  description: "교인, 출석, 주보, 재정을 다루는 공동체 운영",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = await loadShellState();
  return (
    <html lang="ko">
      <body>
        <CommunityTermProvider
          languageModeFromCommunity={shell.languageMode}
          overridesJson={shell.overridesJson}
        >
          <AppShell accountName={shell.accountName}>{children}</AppShell>
        </CommunityTermProvider>
      </body>
    </html>
  );
}
