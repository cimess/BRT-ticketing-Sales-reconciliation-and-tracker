import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/globals.css";
import { ToastContainer, Zoom } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Providers } from "@/components/Providers";
import { auth } from "@/auth";
import { Suspense } from "react"; 
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Oteben",
  description: "Oteben is a ticketer sales reconciliation tool built for speed and reliability.",
};

// 1. This Server Component safely fetches the session
async function AuthWrapper({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return <Providers session={session}>{children}</Providers>;
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
          {/* 2. WRAP THE APP IN AuthWrapper HERE */}
          <AuthWrapper>
            <ToastContainer
              position="top-center"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={true}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              draggablePercent={10}
              theme="dark"
              transition={Zoom}
            />
            {children}
          </AuthWrapper>
        </Suspense>
        <Analytics/>
        <SpeedInsights/>
      </body>
    </html>
  );
}
