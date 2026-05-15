import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "EduStack — Modern School ERP Platform",
  description:
    "Production-grade multi-tenant School ERP SaaS platform for modern educational institutions.",
  keywords: ["school erp", "education management", "school management system", "saas"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-white text-gray-900">
        <ClerkProvider
          afterSignOutUrl="/"
          appearance={{
            elements: {
              formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 text-sm",
              card: "shadow-lg rounded-xl",
              headerTitle: "text-gray-900 font-bold",
              headerSubtitle: "text-gray-500",
              socialButtonsBlockButton: "border-gray-200 hover:bg-gray-50",
              formFieldInput: "rounded-lg border-gray-200 focus:ring-indigo-500",
              footerActionLink: "text-indigo-600 hover:text-indigo-700",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
