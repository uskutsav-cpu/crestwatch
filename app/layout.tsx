import type { Metadata } from "next";
import "./globals.css";
import "./typography.css";
import "leaflet/dist/leaflet.css";
import { AppShell } from "@/components/experience/AppShell";
const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
export const metadata: Metadata = {
  metadataBase: new URL(deploymentHost ? `https://${deploymentHost}` : "http://localhost:3000"),
  title: {
    default: "CrestWatch · Know your river",
    template: "%s · CrestWatch",
  },
  description:
    "Mississippi river forecasts, official impact notes, and animated replays of recorded floods. Built on NOAA and USGS public data.",
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
