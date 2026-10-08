import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#090909",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || requestHeaders.get("host") || "localhost:3000";
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProto || (host.startsWith("localhost") ? "http" : "https");
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const origin = configuredOrigin || `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "MVP Mafia - Info",
      template: "%s | MVP Mafia - Info",
    },
    description:
      "Oficjalne forum informacyjne MVP Mafia: komunikaty, aktualności, zdjęcia, filmy i zarządzana lista społeczności.",
    applicationName: "MVP Mafia - Info",
    icons: { icon: "/favicon.svg" },
    keywords: ["MVP Mafia", "forum", "informacje", "komunikaty"],
    authors: [{ name: "MVP Mafia" }],
    creator: "MVP Mafia",
    openGraph: {
      type: "website",
      locale: "pl_PL",
      url: origin,
      siteName: "MVP Mafia - Info",
      title: "MVP Mafia - Info",
      description: "Oficjalne centrum komunikatów i informacji społeczności.",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "MVP Mafia - Info" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "MVP Mafia - Info",
      description: "Oficjalne centrum komunikatów i informacji społeczności.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
