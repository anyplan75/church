import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { CommunityTermProvider } from "@/components/community-term-provider";
import { loadShellState } from "@/server/community/service";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "모들",
  description: "목사에게 질문하고, 교회와 모들의 일정과 재정을 나눕니다.",
  icons: {
    icon: [{ url: "/modl-icon.png", type: "image/png" }],
    apple: [{ url: "/modl-icon.png", type: "image/png" }],
  },
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
          <AppShell accountName={shell.accountName} menuHrefs={shell.menuHrefs} placeMenus={shell.placeMenus}>{children}</AppShell>
        </CommunityTermProvider>
      </body>
    </html>
  );
}
