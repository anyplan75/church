import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { CommunityTermProvider } from "@/components/community-term-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "모들",
  description: "제주 공동체의 말투로 여는 기독교 공동체",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <CommunityTermProvider>
          <AppShell>{children}</AppShell>
        </CommunityTermProvider>
      </body>
    </html>
  );
}
