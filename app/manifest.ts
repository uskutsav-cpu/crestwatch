import type { MetadataRoute } from "next";
import { copy } from "@/lib/copy";

/* Lets phones "Add to Home Screen" so checking grandma's house is one tap. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: copy.appName,
    short_name: copy.appName,
    description: copy.tagline,
    start_url: "/places",
    display: "standalone",
    background_color: "#0A1620",
    theme_color: "#0A1620",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/pwa/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
