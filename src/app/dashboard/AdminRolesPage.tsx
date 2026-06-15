'use client';
import { ShieldCheck } from 'lucide-react';
import StatCard from '../../components/StatCard';
import { PageScaffold } from '../../components/pageScaffold';

export default function AdminRolesPage() {

  
  return (
    <PageScaffold
      title="Admin • Roles & Permissions"
      subtitle="Define capabilities per role (RBAC)"
      kpis={
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Roles" value="5" icon={<ShieldCheck className="text-blue-300" />} iconBg="bg-blue-500/10" />
          <StatCard title="Critical Ops" value="Protected" icon={<ShieldCheck className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
          <StatCard title="Mutations" value="Throttled" icon={<ShieldCheck className="text-purple-300" />} iconBg="bg-purple-500/10" />
          <StatCard title="Audit" value="Required" icon={<ShieldCheck className="text-amber-300" />} iconBg="bg-amber-500/10" />
        </div>
      }
    >
      <div className="glass-panel rounded-3xl border border-white/5 p-6">
        <p className="text-white font-bold tracking-tight">Placeholder</p>
        <p className="text-slate-500 text-sm mt-2">
          Later: store permissions in a policy table and enforce on API + UI. This page should be admin-only.
        </p>
      </div>
    </PageScaffold>
  );
}