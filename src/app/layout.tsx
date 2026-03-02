import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/AppShell";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "Iterate - AI Bug Detection from Session Replays",
  description: "Find UX bugs from PostHog session recordings",
};

const themeScript = `
(function() {
  var storageKey = 'theme';
  var theme = null;
  try { theme = localStorage.getItem(storageKey); } catch (e) {}
  if (!theme && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
  if (!theme) theme = 'light';
  var root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.style.colorScheme = theme;
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakarta.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-[#fafaf9] text-charcoal dark:bg-[#191919] dark:text-gray-100">
        <script
          dangerouslySetInnerHTML={{ __html: themeScript }}
          suppressHydrationWarning
        />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
