import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Prompt Motion — animated HTML video studio",
  description: "Turn prompts or slides into standalone animated HTML videos built from Remotion, anime.js, Motion and GSAP components.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`} style={{ colorScheme: "dark" }}>
      <body className="h-full overflow-hidden bg-background text-foreground">
        <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
        <Toaster theme="dark" position="bottom-center" richColors />
      </body>
    </html>
  );
}
