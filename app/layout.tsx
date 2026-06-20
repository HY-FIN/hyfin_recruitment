import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HYFIN 리크루팅",
  description: "HYFIN 동아리 리크루팅 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
