import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { QueryProvider } from "./_components/QueryProvider";
import { QuizSubmitRecovery } from "./_components/QuizSubmitRecovery";
import "./globals.css";
import "katex/dist/katex.min.css";

// Self-hosted via next/font: no render-blocking Google Fonts request, automatic
// size-adjust fallback (cuts CLS), display:swap. Weights match real usage in the
// codebase, including 800/900 which the old <link> never loaded (faux-bold before).
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
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
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <QueryProvider>
            <QuizSubmitRecovery />
            {children}
          </QueryProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
