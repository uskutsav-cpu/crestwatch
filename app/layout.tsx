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

export const metadata: Metadata = {
  title: "CrestWatch",
  description: copy.tagline,
};

export const viewport: Viewport = {
  themeColor: "#0A1620",
};

/* Applies the saved theme before first paint to avoid a flash. */
const themeScript = `try{if(localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.theme,
)})==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
