import type { Metadata } from "next";
import "@/globals.css";
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export const metadata: Metadata = {
  title: "Oteben",
  description: "this is the auth page for login and signup which will be used to authenticate users",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      
        <Header />
        {children}
        <Footer />
      
    </>
  );
}



