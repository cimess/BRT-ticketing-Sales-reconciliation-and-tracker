import React from 'react';
import { X } from 'lucide-react';

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[520px] bg-black/90 border-l border-white/10 backdrop-blur-xl transform transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/10">
          <div className="min-w-0">
            <p className="text-white text-sm font-bold tracking-tight truncate">{title}</p>
            {subtitle && <p className="text-slate-500 text-[11px] truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto h-[calc(100vh-3.5rem)]">{children}</div>
      </aside>
    </>
  );
}