import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
import { ConnectionStatus } from "@/components/connection-status";
import { Button } from "@/components/ui/button";
import { Bell, Search, UserCircle } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CG Talent Hub Thailand",
  description: "Enterprise Applicant Tracking System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.className, "bg-background text-foreground transition-colors duration-300")}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex h-screen overflow-hidden">
            {/* Sidebar View */}
            <Sidebar />

            {/* Main Content View */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header */}
              <header className="h-16 border-b flex items-center justify-between px-8 shrink-0 bg-background/50 backdrop-blur-md z-10">
                <div className="flex items-center gap-6">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground hidden lg:block">Architecture: Cloud-Native</h2>
                  <ConnectionStatus />
                </div>

                <div className="flex items-center gap-4">
                  <div className="relative group hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <input
                      type="text"
                      placeholder="Global search..."
                      className="h-10 w-64 rounded-xl bg-secondary/50 pl-10 pr-4 text-xs font-medium border-transparent focus:ring-1 focus:ring-primary transition-all outline-none"
                    />
                  </div>

                  <ThemeToggle />

                  <Button variant="ghost" size="icon" className="rounded-xl relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
                  </Button>

                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-primary/10">
                    <UserCircle className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </header>

              {/* Main Scrollable Area */}
              <main className="flex-1 overflow-y-auto p-8 relative">
                {children}
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
