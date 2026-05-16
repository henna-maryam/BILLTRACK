import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BillTrack Admin",
  description: "Superadmin console for BillTrack.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
