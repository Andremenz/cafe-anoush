import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "کافه آنوش | Café Anoush",
  description: "Restaurant service platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-gray-100 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
