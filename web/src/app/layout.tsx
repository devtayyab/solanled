import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SloanLED Distributor Portal",
  description: "Distributor lead-generation and project visibility for SloanLED Europe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
