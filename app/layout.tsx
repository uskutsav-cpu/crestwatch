import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AppShell } from "@/components/experience/AppShell";
export const metadata: Metadata = {
  metadataBase: new URL(
    "https://crestwatch.vercel.app",
  ),
  title: {
    default: "CrestWatch · Know your river",
    template: "%s · CrestWatch",
  },
  description:
    "A clearer picture before the water rises. Mississippi river forecasts, the places that matter, and the numbers behind the water.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
