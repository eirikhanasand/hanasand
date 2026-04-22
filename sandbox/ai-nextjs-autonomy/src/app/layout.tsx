import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Northstar Atelier",
  description: "Boutique architecture for private homes and hospitality environments, shaped with tactile materials and editorial restraint.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
