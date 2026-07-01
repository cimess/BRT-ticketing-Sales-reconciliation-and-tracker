// src/components/OpsTopBar.tsx

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Roles } from "@prisma/client";
import {
  AlertTriangle,
  Wallet,
  Banknote,
  ClipboardList,
  LogOut,
  Shield,
  Menu,
} from "lucide-react";
import { Button } from "./ui/button";
import { useSession, signOut as authSignOut } from "next-auth/react";
import { useDashboard } from "@/app/dashboard/layout";
import { formatMoney } from "@/lib/utils";

export type UserRole = "TICKETER" | "SUPERVISOR" | "ADMIN" | "AUDITOR";

interface MobileMenuButtonProps {
  onOpenSidebar: () => void;
}


const MetricPill = ({
  icon: Icon,
  iconClass,
  label,
  value,
}: {
  icon: React.ElementType;
  iconClass: string;
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2">
    <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center">
      <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
    </div>
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-none">
        {label}
      </p>
      <p className="text-[12px] font-black text-slate-100 mt-0.5 truncate">
        {value}
      </p>
    </div>
  </div>
);

export function OpsTopBar({
  onOpenSidebar,
}: MobileMenuButtonProps) {
  const navigate = useRouter();
  const { data: session, status } = useSession();
  const { metrics, loading: metricsLoading } = useDashboard();

  const role = session?.user?.role as Roles;
  const userFromSession = session?.user;

  console.log(metrics.pendingRemittances)
  useEffect(() => {
    if (status === "unauthenticated") {
      navigate.push("/");
    }
  }, [status, navigate]);

  if (status === "loading") {
    return (
      <div className="h-16 w-full bg-[#0a0f14] animate-pulse border-b border-white/10" />
    );
  }

  if (!session?.user?.role) {
    navigate.push("/");
    return null;
  }

  const getLabelText = () => {
    switch (role) {
      case "ADMIN":
      case "AUDITOR":
        return {
          float: "Co. Float",
          sales: "Total Sales",
          remit: "Pending Remittance",
        };
      case "SUPERVISOR":
        return {
          float: "Co. Float",
          sales: "Team Sales",
          remit: "Pending Review",
        };
      default:
        return {
          float: "My Float",
          sales: "My Sales",
          remit: "Pending Remittance",
        };
    }
  };

  const labels = getLabelText();

  const handleSignOut = async () => {
    await authSignOut({
      callbackUrl: "/",
      redirect: true,
    });
  };

  return (
    <div className="sticky top-0 z-10 bg-[#0a0f14] border-b border-white/10">
      {/* ───────── DESKTOP ───────── */}
      <header className="hidden md:flex items-center justify-between gap-4 px-5 h-16">
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="p-1.5 bg-white/5 border border-white/10 rounded-lg">
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-100 truncate">
              {userFromSession?.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] font-black uppercase bg-emerald-400/10 text-emerald-400 px-1.5 py-0.5 rounded-md">
                {role}
              </span>
            </div>
          </div>
        </div>
{/*  metrics: {
        availableFloat: financialSnapshot.data.companyBalance,
        salesToday: salesSnapshot.data.totalSales,
        pendingRemittances: salesSnapshot.data.pendingRemittance,
        alertCount,
        totalTopUps: financialSnapshot.data.totalTopUp,
        totalAllocated: financialSnapshot.data.totalAllocated,
        expectedRemittance: financialSnapshot.data.expectedRemittance,
        totalRemitted: salesSnapshot.data.totalRemitted,
        ...(financialSnapshot.data.ledgerReconciliation && {
          ledgerReconciliation: financialSnapshot.data.ledgerReconciliation,
        }), */}

        {/* metrics */}
        <div className="flex items-center gap-2 flex-1 justify-center overflow-x-auto no-scrollbar">
          {metricsLoading ? (
            <div className="text-xs text-slate-500">Loading metrics...</div>
          ) : (
            <>
              <MetricPill
                icon={Wallet}
                iconClass="text-blue-400"
                label={labels.float}
                value={formatMoney(metrics.availableFloat)}
              />
              <MetricPill
                icon={Banknote}
                iconClass="text-emerald-400"
                label={labels.sales}
                value={formatMoney(metrics.salesToday)}
              />
              <MetricPill
                icon={ClipboardList}
                iconClass="text-violet-400"
                label={labels.remit}
                value={formatMoney(metrics.pendingRemittances)}
              />

              <div className="flex items-center gap-2 rounded-xl px-3 py-2 border border-white/8">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-[12px] font-black text-slate-100">
                  {metrics.alertCount} Alerts
                </p>
              </div>
            </>
          )}
        </div>

        <Button
          onClick={handleSignOut}
          variant="outline"
          size="sm"
          className="bg-transparent border-white/10 text-slate-400 hover:text-black cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </Button>
      </header>

      {/* ───────── MOBILE ───────── */}
      <div className="md:hidden">
        {/* top bar */}
        <div className="flex items-center justify-between px-3.5 pt-2.5 pb-2">
          <button
            onClick={onOpenSidebar}
            className="p-2 rounded-lg bg-white/5 border border-white/10"
          >
            <Menu className="w-4 h-4 text-white" />
          </button>

          {/* identity */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-white/5 border border-white/10 rounded-lg">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-100 truncate">
                {userFromSession?.name}
              </p>
              <span className="text-[9px] font-black uppercase text-emerald-400">
                {role}
              </span>
            </div>
          </div>

          {/* sign out */}
          <Button
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            className="bg-transparent border-white/10 text-slate-400"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* metrics grid */}
        <div className="grid grid-cols-2 gap-2 px-3.5 pb-3">
          {metricsLoading ? (
            <div className="col-span-2 text-center text-xs text-slate-500 py-2">Loading metrics...</div>
          ) : (
            <>
              <MetricPill
                icon={Wallet}
                iconClass="text-blue-400"
                label={labels.float}
                value={formatMoney(metrics.availableFloat)}
              />
              <MetricPill
                icon={Banknote}
                iconClass="text-emerald-400"
                label={labels.sales}
                value={formatMoney(metrics.salesToday)}
              />
              <MetricPill
                icon={ClipboardList}
                iconClass="text-violet-400"
                label={labels.remit}
                value={formatMoney(metrics.pendingRemittances)}
              />
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 border border-white/8">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-[12px] font-black text-slate-100">
                  {metrics.alertCount} Alerts
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
