import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { copy } from "@/lib/copy";
import { STORAGE_KEYS } from "@/lib/config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/* Absolute base for share-preview image URLs. Vercel sets this variable
   on every deployment; locally we fall back to the live site. */
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://crestwatch-kalamadalas-projects.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CrestWatch",
  description: copy.tagline,
  applicationName: copy.appName,
  openGraph: {
    title: "CrestWatch",
    description: copy.tagline,
    siteName: copy.appName,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CrestWatch",
    description: copy.tagline,
  },
  appleWebApp: {
    capable: true,
    title: copy.appName,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A1620",
};

/* Applies the saved theme before first paint to avoid a flash. */
const themeScript = `try{if(localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.theme,
)})==="light"){document.documentElement.setAttribute("data-theme","light");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#F4F9FB")}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col font-sans">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
