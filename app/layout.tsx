import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScriptForge",
  description: "AI 辅助小说改编流水线工具"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
