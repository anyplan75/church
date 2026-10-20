import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { CommunityTermProvider } from "@/components/community-term-provider";
import { loadShellState } from "@/server/community/service";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "모들",
  description: "목사에게 질문하고, 교인과 출석과 주보를 다루는 공동체",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = await loadShellState();
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
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
