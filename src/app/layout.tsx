import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Protek | Sistema operativo industrial",
  description: "Sistema AI-native para talleres y empresas de reparación.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
