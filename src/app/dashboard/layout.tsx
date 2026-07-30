"use client";

import "@/globals.css";
import { OpsSidebar } from '../../components/OpsSidebar';
import { OpsTopBar } from '../../components/OpsTopBar';
import { useState, useRef, useEffect, createContext, useContext } from "react";
import { useSession } from "next-auth/react";
import api from "@/app/lib/axios";
import { SseProvider, useSse } from '@/context/SseContext';

export interface DashboardMetrics {
  availableFloat: number;
  salesToday: number;
  pendingRemittances: number;
  alertCount: number;
  totalTopUps?: number;
  totalAllocated?: number;
  expectedRemittance?: number;
  totalRemitted?: number;
  supervisorCash?: number;
  posSessionId?: string | null;
  companyRemitted?: number;
  circulatingFloat?: number;
  topUpBankBalance?: number;
  ledgerReconciliation?: {
    totalCredits: number;
    totalDebits: number;
    computedBalance: number;
    drift: number;
    isInSync: boolean;
  };
}

export interface DashboardContextType {
  metrics: DashboardMetrics;
  loading: boolean;
  refreshMetrics: () => Promise<void>;
}

export const DashboardContext = createContext<DashboardContextType | null>(null);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};

function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    availableFloat: 0,
    salesToday: 0,
    pendingRemittances: 0,
    alertCount: 0
  });
  const [loading, setLoading] = useState(true);
  const { subscribe } = useSse();

  const refreshMetrics = async () => {
    try {
      const res = await api.get("/dashboard/metrics");
      if (res.data?.success) {
        setMetrics(res.data.metrics);
      }
    } catch (err) {
      console.error("Error loading dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.user) return;
    const fetchInit = async () => {
      await refreshMetrics();
    };
    fetchInit();
  }, [session]);

  useEffect(() => {
    const handleEvent = () => {
      const runRefresh = async () => {
        await refreshMetrics();
      };
      runRefresh();
    };
    const unsubscribe = subscribe(handleEvent);
    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  return (
    <DashboardContext.Provider value={{ metrics, loading, refreshMetrics }}>
      {children}
    </DashboardContext.Provider>
  );
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    },0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setMobileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mobileOpen]);

  if (!mounted) {
    return <div className="min-h-screen bg-black" />;
  }

  const onOpenSidebar = () => {
    setMobileOpen(true);
  };

  return (
    <SseProvider role={session?.user?.role || "ADMIN"}>
      <DashboardProvider>
        <div className="flex h-screen overflow-hidden bg-linear-to-b from-zinc-950 via-zinc-900 to-zinc-950

 text-white">
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
              onCloseMobile={() => setMobileOpen(false)}
            />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <OpsTopBar onOpenSidebar={onOpenSidebar} />

            <main className="flex-1 overflow-y-auto p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </DashboardProvider>
    </SseProvider>
  );
}
