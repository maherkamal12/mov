import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "سينما فlix - مشاهدة أفلام اون لاين",
  description:
    "مشاهدة وتحميل أحدث الأفلام العربية والأجنبية بجودة عالية HD اون لاين",
  icons: {
    icon: "/favicons/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#141414] text-white antialiased min-h-screen font-[Cairo,sans-serif]">
        {children}
      </body>
    </html>
  );
}
