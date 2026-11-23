import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NSCI Sports Desk OS", template: "%s · NSCI Sports Desk" },
  description: "Internal task, project, budget and reporting system for the NSCI Sports Desk.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen text-sm">{children}</body>
    </html>
  );
}
