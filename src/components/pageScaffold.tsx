import React from 'react';

export function PageScaffold({
  title,
  subtitle,
  right,
  kpis,
  children,
}: {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
  kpis?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl lg:text-2xl tracking-tight">{title}</h2>
          <p className="text-slate-500 text-xs lg:text-sm">{subtitle}</p>
        </div>
        {right}
      </div>

      {kpis}

      {children}
    </div>
  );
}

export function FilterRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 sm:p-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">{children}</div>
    </div>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full lg:w-72 rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
    />
  );
}

type SelectProps<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
};

export function Select<T extends string>({
  value,
  onChange,
  options,
}: SelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}