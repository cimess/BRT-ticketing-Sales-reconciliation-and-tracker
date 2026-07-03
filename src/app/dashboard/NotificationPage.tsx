// src/app/dashboard/admin/notifications/page.tsx
"use client";
import { Bell, ShieldCheck } from "lucide-react";
import StatCard from "@/components/StatCard";
import { PageScaffold } from "@/components/pageScaffold";
import { DashboardRoleUsers } from "@/app/types/types";

export default function NotificationsPage({ role }: { role: DashboardRoleUsers }) {
  return (
    <PageScaffold
      title="Admin • Notification Center"
      subtitle="Configure event alerts and system logs routing configurations"
      kpis={
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Alert Channels" value="0 Active" icon={<Bell className="text-slate-400" />} iconBg="bg-slate-500/10" />
          <StatCard title="Total Warnings" value="0" icon={<Bell className="text-slate-400" />} iconBg="bg-slate-500/10" />
          <StatCard title="Subscribed Users" value="0" icon={<Bell className="text-slate-400" />} iconBg="bg-slate-500/10" />
          <StatCard title="SMTP Status" value="Inactive" icon={<ShieldCheck className="text-slate-500" />} iconBg="bg-slate-500/10" />
        </div>
      }
    >
      <div className="glass-panel rounded-2xl border border-white/5 p-8 flex flex-col items-center justify-center text-center bg-slate-900/40 min-h-[400px]">
        <div className="p-4 rounded-full bg-slate-800/50 border border-white/5 mb-4 animate-pulse">
          <Bell className="w-10 h-10 text-slate-500" />
        </div>
        <p className="text-white font-bold text-base">Alert Logs Empty</p>
        <p className="text-slate-500 text-xs mt-2 max-w-sm">
          System event triggers and notification handlers can be mapped here in a future release to route push alerts to Telegram, SMS, or Email.
        </p>
      </div>
    </PageScaffold>
  );
}
