import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { CommunityTermProvider } from "@/components/community-term-provider";
import { loadShellState } from "@/server/community/service";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "모들",
  description: "제주 공동체의 말투로 여는 기독교 공동체",
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
