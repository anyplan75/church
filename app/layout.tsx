import type { Metadata } from "next";
import { ChurchFrame } from "@/components/church-frame";
import "./globals.css";

export const metadata: Metadata = {
  title: "예배 운영",
  description: "예배 전에 순서를 점검하고, 주보로 한 주를 준비한 뒤 예배 화면에 송출합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <ChurchFrame>{children}</ChurchFrame>
      </body>
    </html>
  );
}
