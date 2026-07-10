// src/components/Piechart.tsx
"use client";

import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { formatMoney } from "../app/lib/utils";

// Define strict types for the datasets
export interface ChartItem {
  name: string;
  sales: number;
  expected: number;
}

export interface PieChartItem {
  name: string;
  value: number;
}

// Fallback Mock Data (Pruned the invalid 'stroke' property)
const defaultRevenueData1d: ChartItem[] = [
    { name: '12:00', sales: 20000, expected: 20000 },
    { name: '13:00', sales: 30000, expected: 30000 },
    { name: '14:00', sales: 50000, expected: 50000 },
    { name: '15:00', sales: 78000, expected: 78000 },
    { name: '16:00', sales: 90000, expected: 90000 },
    { name: '17:00', sales: 30000, expected: 30000 },
    { name: '18:00', sales: 10000, expected: 10000 },
];

const defaultRevenueData7d: ChartItem[] = [
    { name: 'Mon', sales: 450000, expected: 480000 },
    { name: 'Tue', sales: 320000, expected: 310000 },
    { name: 'Wed', sales: 510000, expected: 500000 },
    { name: 'Thu', sales: 278000, expected: 290000 },
    { name: 'Fri', sales: 890000, expected: 850000 }, // 👈 Removed invalid 'stroke' property
    { name: 'Sat', sales: 930000, expected: 900000 },
    { name: 'Sun', sales: 410000, expected: 420000 },
];

const defaultRevenueData30d: ChartItem[] = [
    { name: 'Week 1', sales: 2100000, expected: 2000000 },
    { name: 'Week 2', sales: 2300000, expected: 2400000 },
    { name: 'Week 3', sales: 2800000, expected: 2700000 },
    { name: 'Week 4', sales: 3100000, expected: 3000000 },
];

const defaultRemittanceData: PieChartItem[] = [
    { name: 'Matched', value: 4500000 },
    { name: 'Pending', value: 850000 },
    { name: 'Investigating', value: 200000 },
    { name: 'Variance', value: 120000 },
];

const COLORS = {
    sales: '#10b981',
    expected: '#3b82f6',
    pie: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444']
};

interface OverviewChartsProps {
  revenueData1d?: ChartItem[];
  revenueData7d?: ChartItem[];
  revenueData30d?: ChartItem[];
  remittanceData?: PieChartItem[];
}

export default function OverviewCharts({
  revenueData1d = defaultRevenueData1d,
  revenueData7d = defaultRevenueData7d,
  revenueData30d = defaultRevenueData30d,
  remittanceData = defaultRemittanceData,
}: OverviewChartsProps) {
    const [timeRange, setTimeRange] = useState<'1d' | '7d' | '30d'>('7d');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true);
        }, 0);
        return () => {
            clearTimeout(timer);
        }
    }, []);

    const currentData = timeRange === '1d' ? revenueData1d : timeRange === '7d' ? revenueData7d : revenueData30d;

    if (!mounted) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <div className="premium-card p-4 lg:col-span-2 h-[380px] bg-slate-900/20 animate-pulse rounded-2xl" />
                <div className="premium-card p-4 h-[380px] bg-slate-900/20 animate-pulse rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* Area Chart for Revenue Trends */}
            <div className="premium-card p-4 lg:col-span-2 flex flex-col h-[380px] group">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            Sales vs Expected Revenue
                        </h3>
                        <p className="premium-label mt-1">
                            {timeRange === '1d' ? '1-day rolling performance' : timeRange === '7d' ? '7-day rolling performance' : 'Monthly aggregated performance'}
                        </p>
                    </div>

                    <div className="flex items-center bg-white/5 p-1 rounded-lg border border-white/5">
                        <button
                            onClick={() => setTimeRange('1d')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${timeRange === '1d' ? 'bg-white/10 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                        >
                            1 Day
                        </button>
                        <button
                            onClick={() => setTimeRange('7d')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${timeRange === '7d' ? 'bg-white/10 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                        >
                            7 Days
                        </button>
                        <button
                            onClick={() => setTimeRange('30d')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${timeRange === '30d' ? 'bg-white/10 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                        >
                            30 Days
                        </button>
                    </div>
                </div>

                <div className="flex-1 w-full h-[280px]">
                    <ResponsiveContainer width="100%" height={280} minWidth={0}>
                        <AreaChart data={currentData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.sales} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={COLORS.sales} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.expected} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={COLORS.expected} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `₦${(value / 1000)}k`} dx={-10} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ffffff20', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <Area type="monotone" dataKey="expected" stroke={COLORS.expected} fillOpacity={1} fill="url(#colorExpected)" strokeWidth={2} activeDot={{ r: 4, strokeWidth: 2, fill: '#000' }} />
                            <Area type="monotone" dataKey="sales" stroke={COLORS.sales} fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} activeDot={{ r: 6, strokeWidth: 2, fill: '#000', stroke: COLORS.sales }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Pie Chart for Remittance Status */}
            <div className="premium-card p-4 flex flex-col h-[380px]">
                <div className="mb-2">
                    <h3 className="text-white font-semibold flex items-center gap-2">Remittance Status</h3>
                    <p className="premium-label mt-1">Current system state</p>
                </div>

                <div className="flex-1 w-full h-[280px] flex items-center justify-center relative">
                    <div className="absolute inset-0 m-auto w-40 h-40 bg-blue-500/10 blur-3xl rounded-full mix-blend-screen pointer-events-none" />
                    <ResponsiveContainer width="100%" height={280} minWidth={0}>
                        <PieChart>
                            <Tooltip content={<CustomTooltip />} />
                            <Pie data={remittanceData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                                {remittanceData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS.pie[index % COLORS.pie.length]} className="hover:brightness-110 hover:-translate-y-1 transition-all duration-300 cursor-pointer drop-shadow-md" />
                                ))}
                            </Pie>
                            <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: '11px' }} formatter={(value) => <span className="text-slate-300 font-medium ml-1.5">{value}</span>} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

// Strictly Typed interfaces for Recharts tooltip payload
interface TooltipPayloadEntry {
  name: string;
  value: number;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

// Safe custom tooltip utilizing strict typings instead of TooltipProps/any
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="premium-card p-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl">
            {label && <p className="font-mono text-[11px] uppercase tracking-widest text-slate-400 mb-3">{label}</p>}
            <div className="space-y-2">
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry?.color }} />
                            <span className="text-slate-300 capitalize">{entry?.name}</span>
                        </div>
                        <span className="font-mono text-white font-bold ml-4">{formatMoney(entry?.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
