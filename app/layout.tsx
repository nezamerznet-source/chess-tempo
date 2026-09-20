import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Tempo — шахматные часы",
  description: "Шахматный таймер с добавлением времени, игроками и историей партий.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f5f5f7" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
