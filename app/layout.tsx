import type { Metadata } from "next";
import { connection } from "next/server";
import { Nav } from "@/components/nav";
import { readDb } from "@/lib/store";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "예배 운영",
  description: "교회 예배 순서를 준비하고, 주보를 만들고, 예배 중에 진행합니다.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const churchName = readDb().settings.churchName;

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
        <Nav churchName={churchName} />
        {children}
      </body>
    </html>
  );
}
