import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Familienkalender",
    short_name: "Kalender",
    description: "Gemeinsamer Kalender für Familie und Freunde, mit Feiertagen und Schulferien in Bayern.",
    lang: "de",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Neuer Termin", url: "/termin/neu", icons: [{ src: "/icon-192.png", sizes: "192x192" }] }],
  };
}
