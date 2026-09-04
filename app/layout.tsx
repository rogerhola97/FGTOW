import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FG TOW | Remolques hechos para avanzar", template: "%s | FG TOW" },
  description: "Diseño y fabricación de remolques, plataformas, remolques para RZR, cuatrimotos y food trailers (food trucks) en Monterrey.",
  icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
  openGraph: { title: "FG TOW | Remolques hechos para avanzar", description: "Remolques para negocio, aventura y trabajo.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
