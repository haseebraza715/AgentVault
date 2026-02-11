import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const displayFont = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgentVault",
  description: "Clean and structure vaults for AI agents.",
  openGraph: {
    title: "AgentVault",
    description: "Clean and structure vaults for AI agents.",
    type: "website",
    siteName: "AgentVault",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentVault",
    description: "Clean and structure vaults for AI agents.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
