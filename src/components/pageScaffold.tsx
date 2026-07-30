import { ChevronDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find the label of the currently selected option
  const selectedLabel = options.find((o) => o.value === value)?.label || "";

  // Close the dropdown list if the user clicks outside of the element
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative w-full lg:w-48 text-left">
      {/* Clickable Select Input Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-white/20 transition-all cursor-pointer"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown 
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ml-2 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`} 
        />
      </button>

      {/* Styled Dropdown List & Active States */}
      {isOpen && (
        <ul className="absolute z-50 w-full mt-2 p-1.5 bg-zinc-950 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto focus:outline-hidden">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`
                  px-3.5 py-2 text-sm rounded-lg cursor-pointer transition-colors truncate
                  ${isSelected
                    ? "bg-amber-600 text-white font-semibold" // Active/selected option background & text
                    : "text-slate-300 hover:bg-white/5 hover:text-white" // Hover background & text
                  }
                `}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
