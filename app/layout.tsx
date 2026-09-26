import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-F79LC6G41Y";

export const metadata: Metadata = {
  title: { default: "FG TOW | Remolques hechos para avanzar", template: "%s | FG TOW" },
  description: "Diseño y fabricación de remolques, plataformas, remolques para RZR, cuatrimotos y food trailers (food trucks) en Monterrey.",
  icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
  openGraph: { title: "FG TOW | Remolques hechos para avanzar", description: "Remolques para negocio, aventura y trabajo.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {children}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
