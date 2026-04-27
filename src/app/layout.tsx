import type { Metadata } from "next";
import { Roboto_Flex, Montserrat, Inter, IBM_Plex_Sans_Condensed, Barlow_Condensed, Zilla_Slab } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-roboto-flex",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const ibmPlexSansCondensed = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-condensed",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-barlow-condensed",
});

const zillaSlab = Zilla_Slab({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-zilla-slab",
});

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
    <html lang="en" className={`${robotoFlex.variable} ${montserrat.variable} ${inter.variable} ${ibmPlexSansCondensed.variable} ${barlowCondensed.variable} ${zillaSlab.variable}`}>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
