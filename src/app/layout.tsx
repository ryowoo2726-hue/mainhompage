import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "2학년 2반 · 출결 관리", description: "마석중학교 2학년 2반 통합 관리" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
