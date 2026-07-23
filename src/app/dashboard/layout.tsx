"use client"
import "@/globals.css";
import { OpsSidebar } from '../../components/OpsSidebar';
import { OpsTopBar } from '../../components/OpsTopBar';
import { useState, useRef, useEffect } from "react";
import { SseProvider } from '@/context/SseContext';
import { useSession } from "next-auth/react";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (
      mobileOpen &&
      sidebarRef.current &&
      !sidebarRef.current.contains(event.target as Node)
    ) {
      setMobileOpen(false);
    }
  }

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [mobileOpen]);

  function onOpenSidebar() {
    setMobileOpen(true);
  }
  const { data } = useSession();
  return (
    <>
      <div className="flex h-screen overflow-hidden bg-linear-to-b from-black via-slate-950 to-black text-white">
        <div className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden pointer-events-none opacity-0`} />

        <div
  className={`
    fixed inset-y-0 left-0 z-50 transition-transform duration-300
    lg:static lg:translate-x-0
    ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
  `}
  ref={sidebarRef}
        >
          <OpsSidebar 
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          onCloseMobile={() => setMobileOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <OpsTopBar onOpenSidebar={onOpenSidebar} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <SseProvider role={data?.user?.role || "ADMIN"}>{children}</SseProvider>
        </main>
      </div>
    </div >
    </>
  );
}



