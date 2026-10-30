import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_COOKIE, isTheme, themeBootstrapScript } from "@/lib/theme";
import { BRAND } from "@/config/brand";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: "Gestão de aluguer de mobiliário e equipamentos para eventos.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(stored) ? stored : null;

  return (
    <html
      lang="pt-PT"
      className={`${inter.variable} ${interTight.variable} ${theme === "dark" ? "dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        {/* Sem preferência guardada: segue o tema do sistema antes da primeira pintura.
            (Em desenvolvimento, a página 404 mostra um aviso inofensivo do React sobre este script.) */}
        {theme === null && <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />}
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
