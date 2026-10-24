import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/query-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const metadata: Metadata = {
  title: "Kero Admin Dashboard",
  description: "Enterprise Operations & Fleet Management Portal",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon-114x114.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('kero-ui-preferences');
                  if (stored) {
                    var parsed = JSON.parse(stored);
                    if (parsed && parsed.state && parsed.state.isDarkMode) {
                      document.documentElement.classList.add('dark');
                      document.documentElement.setAttribute('data-theme', 'dark');
                      document.documentElement.style.colorScheme = 'dark';
                      return;
                    }
                  }
                  document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-theme', 'light');
                  document.documentElement.style.colorScheme = 'light';
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <AppProviders>
          <DashboardShell>{children}</DashboardShell>
        </AppProviders>
      </body>
    </html>
  );
}
