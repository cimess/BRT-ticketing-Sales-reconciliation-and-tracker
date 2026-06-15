import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CalendarMode = 'single' | 'range';

export interface DateRange {
    startDate: Date | null;
    endDate: Date | null;
}

interface CalendarProps {
    /** 'single' picks one date; 'range' picks start → end */
    mode?: CalendarMode;
    /** Controlled single date */
    value?: Date | null;
    /** Controlled range value */
    range?: DateRange;
    /** Fires for single mode */
    onChange?: (date: Date) => void;
    /** Fires for range mode */
    onRangeChange?: (range: DateRange) => void;
    /** Placeholder text shown in the trigger button */
    placeholder?: string;
    /** Highlight these specific dates (e.g. event markers) */
    markedDates?: Date[];
    /** Disable all dates before this date */
    minDate?: Date;
    /** Disable all dates after this date */
    maxDate?: Date;
    /** Additional class for the trigger wrapper */
    className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function isSameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function isBetween(date: Date, start: Date | null, end: Date | null) {
    if (!start || !end) return false;
    return date > start && date < end;
}

function isDisabled(date: Date, min?: Date, max?: Date) {
    if (min && date < min) return true;
    if (max && date > max) return true;
    return false;
}

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

function formatDate(date: Date | null) {
    if (!date) return '';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatRange(range: DateRange) {
    if (!range.startDate && !range.endDate) return '';
    if (range.startDate && !range.endDate) return formatDate(range.startDate);
    return `${formatDate(range.startDate)} → ${formatDate(range.endDate)}`;
}

// ─── Preset Ranges ───────────────────────────────────────────────────────────

const PRESETS: { label: string; getRange: () => DateRange }[] = [
    {
        label: 'Today',
        getRange: () => { const d = new Date(); return { startDate: d, endDate: d }; },
    },
    {
        label: 'Yesterday',
        getRange: () => {
            const d = new Date(); d.setDate(d.getDate() - 1);
            return { startDate: d, endDate: d };
        },
    },
    {
        label: 'Last 7 days',
        getRange: () => {
            const end = new Date();
            const start = new Date(); start.setDate(end.getDate() - 6);
            return { startDate: start, endDate: end };
        },
    },
    {
        label: 'Last 30 days',
        getRange: () => {
            const end = new Date();
            const start = new Date(); start.setDate(end.getDate() - 29);
            return { startDate: start, endDate: end };
        },
    },
    {
        label: 'This month',
        getRange: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return { startDate: start, endDate: end };
        },
    },
    {
        label: 'Last month',
        getRange: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            return { startDate: start, endDate: end };
        },
    },
];

// ─── Month Grid ───────────────────────────────────────────────────────────────

interface MonthGridProps {
    year: number;
    month: number;
    mode: CalendarMode;
    selectedDate: Date | null;
    range: DateRange;
    hoverDate: Date | null;
    markedDates?: Date[];
    minDate?: Date;
    maxDate?: Date;
    onDayClick: (date: Date) => void;
    onDayHover: (date: Date | null) => void;
}

function MonthGrid({
    year, month, mode, selectedDate, range, hoverDate,
    markedDates, minDate, maxDate, onDayClick, onDayHover,
}: MonthGridProps) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const cells: (Date | null)[] = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];
    // pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
                {DAYS.map((d) => (
                    <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((date, idx) => {
                    if (!date) return <div key={`empty-${idx}`} />;

                    const today = new Date();
                    const isToday = isSameDay(date, today);
                    const isSelected = mode === 'single'
                        ? (selectedDate ? isSameDay(date, selectedDate) : false)
                        : (range.startDate ? isSameDay(date, range.startDate) : false) ||
                        (range.endDate ? isSameDay(date, range.endDate) : false);

                    const isStart = mode === 'range' && range.startDate && isSameDay(date, range.startDate);
                    const isEnd = mode === 'range' && range.endDate && isSameDay(date, range.endDate);

                    const effectiveEnd = range.endDate ?? hoverDate;
                    const inRange = mode === 'range' && isBetween(date, range.startDate, effectiveEnd);

                    const isMarked = markedDates?.some((m) => isSameDay(date, m));
                    const disabled = isDisabled(date, minDate, maxDate);

                    return (
                        <button
                            key={date.toISOString()}
                            disabled={disabled}
                            onClick={() => onDayClick(date)}
                            onMouseEnter={() => onDayHover(date)}
                            onMouseLeave={() => onDayHover(null)}
                            className={[
                                'relative flex items-center justify-center text-xs font-medium h-8 w-full transition-all duration-100 select-none',
                                // range in-between cell highlight
                                inRange && !isSelected ? 'bg-blue-500/10 text-blue-200' : '',
                                // rounded caps for range start/end
                                isStart && range.endDate ? 'rounded-l-full' : '',
                                isEnd && range.startDate ? 'rounded-r-full' : '',
                                // single selected / start / end dot
                                isSelected
                                    ? 'bg-blue-500 text-white rounded-full shadow-lg shadow-blue-500/30 z-10'
                                    : !inRange
                                        ? 'rounded-full hover:bg-white/8 text-slate-300'
                                        : '',
                                isToday && !isSelected ? 'font-bold text-white' : '',
                                disabled ? 'opacity-20 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
                            ].join(' ')}
                        >
                            {date.getDate()}
                            {/* Today indicator dot */}
                            {isToday && !isSelected && (
                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                            )}
                            {/* Event marker */}
                            {isMarked && !isSelected && (
                                <span className="absolute top-0.5 right-1 w-1 h-1 rounded-full bg-amber-400" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main Calendar Component ──────────────────────────────────────────────────

const Calendar: React.FC<CalendarProps> = ({
    mode = 'range',
    value = null,
    range: controlledRange,
    onChange,
    onRangeChange,
    placeholder,
    markedDates,
    minDate,
    maxDate,
    className = '',
}) => {
    const today = new Date();

    // internal state
    const [isOpen, setIsOpen] = useState(false);
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState<Date | null>(value);
    const [range, setRange] = useState<DateRange>(
        controlledRange ?? { startDate: null, endDate: null }
    );
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    const [selectingEnd, setSelectingEnd] = useState(false);

    const [rightViewYear, setRightViewYear] = useState(today.getFullYear());
    const [rightViewMonth, setRightViewMonth] = useState(
        today.getMonth() === 11 ? 0 : today.getMonth() + 1
    );
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        
        if (controlledRange) {
            // eslint-disable-next-line
            setRange(controlledRange);
        }
    }, [controlledRange]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
        else setViewMonth((m) => m - 1);
    };

    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
        else setViewMonth((m) => m + 1);
    };

    const prevRightMonth = () => {
        if (rightViewMonth === 0) { setRightViewMonth(11); setRightViewYear((y) => y - 1); }
        else setRightViewMonth((m) => m - 1);
    };

    const nextRightMonth = () => {
        if (rightViewMonth === 11) { setRightViewMonth(0); setRightViewYear((y) => y + 1); }
        else setRightViewMonth((m) => m + 1);
    };


    const handleDayClick = useCallback((date: Date) => {
        if (mode === 'single') {
            setSelectedDate(date);
            onChange?.(date);
            setIsOpen(false)
            return;
        }


        // range mode
        if (!selectingEnd || !range.startDate) {
            setRange({ startDate: date, endDate: null });
            setSelectingEnd(true);
        } else {
            const ordered = date < range.startDate
                ? { startDate: date, endDate: range.startDate }
                : { startDate: range.startDate, endDate: date };
            setRange(ordered);
            setSelectingEnd(false);
            onRangeChange?.(ordered);
            setIsOpen(false);
        }
    }, [mode, selectingEnd, range.startDate, onChange, onRangeChange, setIsOpen, setSelectedDate, setRange, setSelectingEnd]);

    const handlePreset = (preset: typeof PRESETS[0]) => {
        const r = preset.getRange();
        setRange(r);
        setSelectingEnd(false);
        onRangeChange?.(r);
        if (r.startDate) {
            setViewYear(r.startDate.getFullYear());
            setViewMonth(r.startDate.getMonth());
        }
        setIsOpen(false);
    };

    const clearSelection = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (mode === 'single') {
            setSelectedDate(null);
            onChange?.(null as unknown as Date);
        } else {
            const cleared = { startDate: null, endDate: null };
            setRange(cleared);
            onRangeChange?.(cleared);
        }
    };

    // Trigger button label
    const hasValue = mode === 'single' ? !!selectedDate : !!(range.startDate);
    const triggerLabel = mode === 'single'
        ? (selectedDate ? formatDate(selectedDate) : (placeholder ?? 'Select date'))
        : (range.startDate ? formatRange(range) : (placeholder ?? 'Select date range'));


    return (
        <div className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                ref={triggerRef}
                id="calendar-trigger"
                onClick={() => setIsOpen((o) => !o)}
                className={[
                    'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200 w-full sm:w-auto justify-between sm:justify-start',
                    'bg-white/3 border-white/10 text-slate-400 hover:bg-white/6 hover:text-white hover:border-white/20',
                    isOpen ? 'bg-white/6 border-white/20 text-white' : '',
                ].join(' ')}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                    <span className="truncate max-w-[180px] sm:max-w-[200px]">{triggerLabel}</span>
                </div>
                {hasValue && (
                    <span
                        role="button"
                        tabIndex={0}
                        onClick={clearSelection}
                        onKeyDown={(e) => e.key === 'Enter' && clearSelection(e as unknown as React.MouseEvent)}
                        className="ml-2 text-slate-500 hover:text-white transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </span>
                )}
            </button>

            {/* Popover */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    className={[
                        'absolute z-50 mt-2 right-0',
                        'rounded-2xl border border-white/10 bg-[#111113]/95 backdrop-blur-xl',
                        'shadow-[0_32px_80px_-16px_rgba(0,0,0,0.9)]',
                        'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2',
                        mode === 'range' ? 'w-[calc(100vw-2rem)] sm:w-[640px]' : 'w-[280px]',
                    ].join(' ')}
                    style={{ minWidth: mode === 'range' ? 'min(90vw, 640px)' : 260 }}
                >
                    {/* Popover header */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/6">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            {mode === 'range' ? 'Select date range' : 'Select date'}
                        </span>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-slate-600 hover:text-slate-300 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row">
                        {/* Preset sidebar – range mode only (horizontal list on mobile, vertical sidebar on desktop) */}
                        {mode === 'range' && (
                            <div className="flex flex-row md:flex-col gap-1 p-3 border-b md:border-b-0 md:border-r border-white/6 overflow-x-auto w-full md:w-36 shrink-0 scrollbar-none">
                                <p className="hidden md:block text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1 px-1">Quick select</p>
                                {PRESETS.map((preset) => (
                                    <button
                                        key={preset.label}
                                        onClick={() => handlePreset(preset)}
                                        className="whitespace-nowrap text-left text-xs text-slate-400 hover:text-white hover:bg-white/5 px-2.5 py-1.5 rounded-lg transition-colors"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Calendar grids */}
                        <div className={`flex gap-0 ${mode === 'range' ? 'flex-1' : 'w-full'}`}>
                            {/* Month 1 */}
                            <div className="flex-1 p-3">
                                {/* Nav */}
                                <div className="flex items-center justify-between mb-3">
                                    <button
                                        onClick={prevMonth}
                                        className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-all"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm font-semibold text-white tracking-tight">
                                        {MONTHS[viewMonth]} {viewYear}
                                    </span>
                                    {/* Show right arrow on Month 1 on mobile in range mode since Month 2 is hidden */}
                                    <button
                                        onClick={nextMonth}
                                        className={`flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-all ${mode === 'range' ? 'sm:hidden' : ''}`}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>

                                <MonthGrid
                                    year={viewYear}
                                    month={viewMonth}
                                    mode={mode}
                                    selectedDate={selectedDate}
                                    range={range}
                                    hoverDate={hoverDate}
                                    markedDates={markedDates}
                                    minDate={minDate}
                                    maxDate={maxDate}
                                    onDayClick={handleDayClick}
                                    onDayHover={setHoverDate}
                                />
                            </div>

                            {/* Month 2 – range only (hidden on mobile, shown on tablet/desktop) */}
                            {mode === 'range' && (
                                <div className="hidden sm:flex flex-1 gap-0">
                                    <div className="w-px bg-white/6 my-3" />
                                    <div className="flex-1 p-3">
                                        <div className="flex items-center justify-between mb-3">
                                            <button
                                                onClick={prevRightMonth}
                                                className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-all"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <span className="text-sm font-semibold text-white tracking-tight">
                                                {MONTHS[rightViewMonth]} {rightViewYear}
                                            </span>
                                            <button
                                                onClick={nextRightMonth}
                                                className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-all"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <MonthGrid
                                            year={rightViewYear}
                                            month={rightViewMonth}
                                            mode={mode}
                                            selectedDate={selectedDate}
                                            range={range}
                                            hoverDate={hoverDate}
                                            markedDates={markedDates}
                                            minDate={minDate}
                                            maxDate={maxDate}
                                            onDayClick={handleDayClick}
                                            onDayHover={setHoverDate}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer – shows live selection status */}
                    {mode === 'range' && (range.startDate || range.endDate) && (
                        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/6">
                            <div className="flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs">
                                <span className="text-slate-500">From</span>
                                <span className="font-mono text-slate-200">{formatDate(range.startDate)}</span>
                                {range.endDate && (
                                    <>
                                        <span className="text-slate-600">→</span>
                                        <span className="font-mono text-slate-200">{formatDate(range.endDate)}</span>
                                    </>
                                )}
                                {selectingEnd && !range.endDate && (
                                    <span className="text-amber-400 text-[9px] animate-pulse">Pick end date…</span>
                                )}
                            </div>
                            <button
                                onClick={clearSelection}
                                className="text-[10px] text-slate-500 hover:text-red-400 transition-colors font-medium"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

};

export default Calendar;
