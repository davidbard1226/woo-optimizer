import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "WooCommerce AI Optimizer",
  description: "AI-powered product optimization dashboard for WooCommerce",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-gray-950 p-6">
            <Toaster
              position="top-right"
              toastOptions={{
                style: { background: "#1e293b", color: "#f1f5f9", border: "1px solid #334155" },
              }}
            />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
