import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"


export function formatMoney(amount: number, currency: 'NGN' | 'USD' = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency ,maximumFractionDigits:2,minimumFractionDigits:2}).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}


export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`;
}

export function hashLike(prefix = 'h') {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`.slice(0, 18);
}
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Add this helper to src/app/lib/utils.ts
export function formatDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—"; // Safeguard against invalid date strings
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}
