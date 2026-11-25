import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { QueryProvider } from "./_components/QueryProvider";
import { QuizSubmitRecovery } from "./_components/QuizSubmitRecovery";
import "./globals.css";
import "katex/dist/katex.min.css";

// Self-hosted from the repo (Montserrat variable font, latin, weights 100-900; licence in
// app/fonts/OFL.txt). No Google Fonts download at build time, which broke Netlify builds.
const montserrat = localFont({
  src: "./fonts/montserrat-latin-wght.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-montserrat",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OpenGradHub",
  description: "OpenGradHub local authentication and dashboard shell",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ClerkProvider>
          <QueryProvider>
            <QuizSubmitRecovery />
            <Toaster position="top-right" richColors />
            {children}
          </QueryProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
