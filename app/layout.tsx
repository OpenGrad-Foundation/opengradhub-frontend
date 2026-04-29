import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { isClerkMode } from "@/lib/auth-session";
import "./globals.css";

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
  const clerkEnabled = isClerkMode();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {clerkEnabled ? (
          <ClerkProvider>{children}</ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
