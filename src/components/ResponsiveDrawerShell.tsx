// app/src/dashboard/component/UnifiedDrawerShell.tsx
import React from 'react';
import { Sparkles } from 'lucide-react';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const toneClass: Record<Tone, string> = {
  default: 'border-white/5 bg-white/[0.04] text-slate-300',
  success: 'border-emerald-500/15 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-500/15 bg-amber-500/10 text-amber-200',
  danger: 'border-red-500/15 bg-red-500/10 text-red-200',
  info: 'border-blue-500/15 bg-blue-500/10 text-blue-200',
};

export type DrawerStat = {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
};

export type DrawerField = {
  label: string;
  value: React.ReactNode;
};

export type DrawerSection = {
  title: string;
  content: React.ReactNode;
};

function MetricCard({ label, value, tone = 'default' }: DrawerStat) {
  return (
    <div className={`rounded-2xl border px-3 py-3 shadow-sm ${toneClass[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function FieldCard({ label, value }: DrawerField) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-200 break-words">{value}</div>
    </div>
  );
}

function SectionCard({ title, content }: DrawerSection) {
  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-white">{title}</p>
        <Sparkles className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
      </div>
      <div className="mt-3">{content}</div>
    </div>
  );
}

export function ResponsiveDrawerShell({
  title,
  subtitle,
  badge,
  stats = [],
  fields = [],
  sections = [],
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  stats?: DrawerStat[];
  fields?: DrawerField[];
  sections?: DrawerSection[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/5 bg-linear-to-br from-white/[0.08] to-white/[0.03] p-4 shadow-2xl shadow-black/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Summary</p>
            <h3 className="mt-1 truncate text-lg font-bold text-white">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
          </div>

          {badge ?? (
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.04] text-slate-300">
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </div>
          )}
        </div>
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <MetricCard key={stat.label} {...stat} />
          ))}
        </div>
      )}

      {fields.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <FieldCard key={field.label} {...field} />
          ))}
        </div>
      )}

      {sections.map((section) => (
        <SectionCard key={section.title} title={section.title} content={section.content} />
      ))}
    </div>
  );
}