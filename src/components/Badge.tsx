
type Variant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const variantClass: Record<Variant, string> = {
  neutral: 'bg-white/5 text-slate-300 border-white/10',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  danger: 'bg-red-500/10 text-red-300 border-red-500/20',
  info: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  
};

export function Badge({
  children,
  variant = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${variantClass[variant]} ${className}`}
    >
      {children}
    </span>
  );
}