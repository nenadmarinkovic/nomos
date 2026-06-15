import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "./providers";
import "./globals.css";

const sans = localFont({
  src: "./fonts/google-sans-flex.woff2",
  variable: "--font-sans",
  weight: "1 1000",
  display: "swap",
});

const newsreader = localFont({
  src: [
    {
      path: "./fonts/newsreader.woff2",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "./fonts/newsreader-italic.woff2",
      weight: "200 800",
      style: "italic",
    },
  ],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nomos",
  description:
    "A society simulation where agents follow simple rules and AI theorists observe what emerges.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${newsreader.variable} antialiased`}
    >
      <body className="h-screen overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
