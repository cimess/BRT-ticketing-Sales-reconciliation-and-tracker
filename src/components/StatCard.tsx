import { cloneElement, type ReactElement } from 'react';
import { TrendingUp, TrendingDown, type LucideProps } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  iconBg?: string;
  subtitle?: string;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  iconBg = 'bg-white/5',
  subtitle,
  className = '',
}) => {
  return (
    <div className={`premium-card group relative overflow-hidden rounded-xl p-2.5 sm:p-3.5 hover:translate-y-[-2px] transition-all duration-300 shadow-sm shadow-gray-900/60 ${className}`}>
      {/* gloss */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent" />

      <div className="relative flex items-start justify-between gap-2">

        {/* Text — min-w-0 is critical: allows flex-1 to shrink and not push the icon */}
        <div className="min-w-0 flex-1">
          <p className="premium-label truncate text-[9px] sm:text-[10px] uppercase tracking-widest opacity-70 mb-1">
            {title}
          </p>
          <p
            className="truncate font-mono tabular-nums font-bold tracking-tight text-white text-sm sm:text-lg lg:text-xl mb-0.5"
            title={value}
          >
            {value}
          </p>
          {subtitle && (
            <p className="truncate text-slate-500 text-[9px] sm:text-[10px] font-medium">
              {subtitle}
            </p>
          )}
          {change && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono ${
                changeType === 'up'   ? 'bg-emerald-500/10 text-emerald-400' :
                changeType === 'down' ? 'bg-rose-500/10 text-rose-400' :
                                        'bg-white/5 text-slate-400'
              }`}>
                {changeType === 'up'   && <TrendingUp   className="w-2.5 h-2.5" strokeWidth={2} />}
                {changeType === 'down' && <TrendingDown  className="w-2.5 h-2.5" strokeWidth={2} />}
                {change}
              </div>
              <span className="hidden sm:block text-slate-600 text-[9px] font-bold uppercase tracking-wider">
                vs last month
              </span>
            </div>
          )}
        </div>

        {/* Icon — shrink-0 + fixed size = NEVER gets pushed out */}
        <div className={`shrink-0 rounded-lg sm:rounded-xl border border-white/5 group-hover:border-white/10 ${iconBg} flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 transition-all duration-300 shadow-md shadow-black/20`}>
          {cloneElement(icon as ReactElement<LucideProps>, {
            className: 'w-4 h-4 sm:w-4.5 sm:h-4.5',
            strokeWidth: 1.5,
          })}
        </div>

      </div>
    </div>
  );
};

export default StatCard;
