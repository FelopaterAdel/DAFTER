import type { MetadataRoute } from "next";

/**
 * Installable-but-online: Daftar shows live money data, so Phase 2 ships no
 * service worker — adding the app to the home screen must never cache a
 * balance.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "دفتر — إدارة العهد والتحصيل",
    short_name: "دفتر",
    description:
      "دفتر بسيط لإدارة العهد والبضاعة والزبائن والتحصيل اليومي ومخزنك الخاص.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f3ea",
    theme_color: "#17553d",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
