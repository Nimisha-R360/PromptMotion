import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Studio } from "@/components/studio/studio";

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={250}>
        <Studio />
      </TooltipProvider>
      <Toaster position="bottom-center" richColors />
    </ThemeProvider>
  );
}
