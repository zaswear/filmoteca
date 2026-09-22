import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Archivo, Archivo_Black, Newsreader } from "next/font/google";
import { Providers } from "@/components/providers";
import { RegisterSW } from "@/components/ui/register-sw";
import "./globals.css";

import { APP_NAME, APP_TAGLINE, APP_URL, BUGSNAG_API_KEY } from "@/lib/branding";
// «Filmoteca»: archivo de cine sobre papel, no revista nocturna. Archivo Black
// hace de marquesina en los titulares, Archivo lleva la interfaz y Newsreader
// la prosa (sinopsis, notas). Antes eran Cormorant + DM Sans + Space Mono.
const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-archivo-black",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-archivo",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  openGraph: { type: "website", images: ["/og.png"] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
  robots: "noindex, nofollow",
};

// Colores de globals.css (--bg / --accent) para la barra del sistema en la
// app instalada.
export const viewport: Viewport = {
  themeColor: "#EDE8DE",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${archivoBlack.variable} ${archivo.variable} ${newsreader.variable}`}
    >
      <body>
        {BUGSNAG_API_KEY && (
          <>
            <Script
              src="//d2wy8f7a9ursnm.cloudfront.net/v8/bugsnag.min.js"
              strategy="beforeInteractive"
            />
            <Script id="bugsnag-start" type="module" strategy="beforeInteractive">
              {`import BugsnagPerformance from '//d2wy8f7a9ursnm.cloudfront.net/v1/bugsnag-performance.min.js'
Bugsnag.start({ apiKey: ${JSON.stringify(BUGSNAG_API_KEY)} })
BugsnagPerformance.start({ apiKey: ${JSON.stringify(BUGSNAG_API_KEY)} })`}
            </Script>
          </>
        )}
        <Providers>{children}</Providers>
        <RegisterSW />
      </body>
    </html>
  );
}
