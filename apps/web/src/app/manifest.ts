import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BillTrack",
    short_name: "BillTrack",
    description: "Mobile-first billing, stock, and report management.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f8f4",
    theme_color: "#111827",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
