import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { CommunityTermProvider } from "@/components/community-term-provider";
import { loadShellState } from "@/server/community/service";
import { sidebarHrefs } from "@/theme/menu-access";
import "./globals.css";

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

const guestMenuHrefs = sidebarHrefs({ formal: false, officer: false });

/** 본문 자료가 아직일 때 껍데기만 먼저 보이게 둡니다. */
function MainFallback() {
  return <div className="min-h-40 animate-pulse rounded-2xl bg-[#e2e8f0]/40" aria-hidden />;
}

async function ShellFrame({ children }: { children: React.ReactNode }) {
  const shell = await loadShellState();
  return (
    <CommunityTermProvider languageModeFromCommunity={shell.languageMode} overridesJson={shell.overridesJson}>
      <AppShell accountName={shell.accountName} menuHrefs={shell.menuHrefs} placeMenus={shell.placeMenus}>
        <Suspense fallback={<MainFallback />}>{children}</Suspense>
      </AppShell>
    </CommunityTermProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Suspense
          fallback={
            <CommunityTermProvider>
              <AppShell accountName={null} menuHrefs={guestMenuHrefs} placeMenus={[]}>
                <MainFallback />
              </AppShell>
            </CommunityTermProvider>
          }
        >
          <ShellFrame>{children}</ShellFrame>
        </Suspense>
      </body>
    </html>
  );
}
