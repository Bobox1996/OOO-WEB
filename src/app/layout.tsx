import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OOO",
  description: "Architecture and Design Studio",
  keywords: ["architecture", "design", "studio", "portfolio"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
