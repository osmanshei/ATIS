import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATIS Web",
  description: "AL-KHALIDIYA TECHNICAL ISLAMIC SCHOOL management platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
