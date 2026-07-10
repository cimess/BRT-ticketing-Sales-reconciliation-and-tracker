"use client";

import { useSession } from "next-auth/react";
import { useDashboard } from "@/app/dashboard/layout";
import AdminOverview from "@/app/dashboard/admin/overview/page";
import SupervisorOverview from "@/app/dashboard/supervisor/overview/page";
import TicketerOverview from "@/app/dashboard/ticketer/overview/page";

const Spinner = ({ className = "h-8 w-8 text-sky-400" }) => (
  <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
);

export default function OverviewPage() {
  const { data: session } = useSession();
  const { metrics, loading, refreshMetrics } = useDashboard();

  if (loading || !session?.user) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const role = session.user.role;
  if(!session.user.id || session.user.role !== role){
    return (
      <div className="p-6 text-center text-red-400 font-semibold border border-red-500/20 bg-red-500/5 rounded-2xl">
        Access Denied: Invalid role selection.
      </div>
    );
  }

  switch (role) {
    case "ADMIN":
    case "AUDITOR":
      return <AdminOverview metrics={metrics} onRefresh={refreshMetrics} />;

    case "SUPERVISOR":
      return <SupervisorOverview metrics={metrics} onRefresh={refreshMetrics} userId={session.user.id} />;

    case "TICKETER":
      return <TicketerOverview metrics={metrics} onRefresh={refreshMetrics} userId={session.user.id} />;

    default:
      return (
        <div className="p-6 text-center text-red-400 font-semibold border border-red-500/20 bg-red-500/5 rounded-2xl">
          Access Denied: Invalid role selection.
        </div>
      );
  }
}
