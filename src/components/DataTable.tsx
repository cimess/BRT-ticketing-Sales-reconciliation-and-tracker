import React from 'react';
import { ArrowUpDown, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';

export type ColumnDef<T> = {
  id: string;
  header: string;
  cell: (row?: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  className?: string;
};

type SortState = { columnId: string; dir: 'asc' | 'desc' };

function alignClass(align?: ColumnDef<unknown>['align']) {
  if (align === 'right') return 'lg:text-right';
  if (align === 'center') return 'lg:text-center';
  return 'lg:text-left';
}

function getSortIcon(active: boolean, dir?: SortState['dir']) {
  if (!active) return <ArrowUpDown className="w-3 h-3" strokeWidth={1.75} />;
  return dir === 'asc' ? <ChevronUp className="w-3 h-3" strokeWidth={1.75} /> : <ChevronDown className="w-3 h-3" strokeWidth={1.75} />;
}

type DataTableProps<T> = {
  rows: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  searchValue?: string;
  searchPredicate?: (row: T, q: string) => boolean;
  emptyLabel?: string;
};

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  onRowClick,
  searchValue,
  searchPredicate,
  emptyLabel = 'No records found.',
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<SortState | null>(null);

  const filtered = !searchValue || !searchPredicate ? rows : rows.filter((row) => searchPredicate(row, searchValue.trim().toLowerCase()));
  

const sortedRows = () => {
  if (!sort) return filtered;

  const column = columns.find((c) => c.id === sort.columnId);
  if (!column?.sortValue) return filtered;

  const copy = [...filtered];

  copy.sort((a, b) => {
    const left = column.sortValue!(a);
    const right = column.sortValue!(b);

    const l = typeof left === "number" ? left : String(left).toLowerCase();
    const r = typeof right === "number" ? right : String(right).toLowerCase();

    if (l < r) return sort.dir === "asc" ? -1 : 1;
    if (l > r) return sort.dir === "asc" ? 1 : -1;
    return 0;
  });

  return copy;
};
const sorted = sortedRows();
  

  const activeSortColumn = sort ? columns.find((column) => column.id === sort.columnId) ?? null : null;
  const sortableColumns = columns.filter((column) => Boolean(column.sortValue));
  const primaryColumn = columns[0];
  const secondaryColumn = columns[1];
  const detailColumns = columns.slice(2);

  const setSortFor = (columnId: string) => {
    setSort((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, dir: 'asc' };
      return { columnId, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
  };

  const renderEmptyState = () => (
    <div className="px-4 py-12 text-center">
      <p className="text-sm text-slate-500">{emptyLabel}</p>
    </div>
  );

  const renderMobileRow = (row: T) => {
    const rowId = getRowId(row);
    const canClick = Boolean(onRowClick);

    const content = (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {primaryColumn && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{primaryColumn.header}</p>
                <div className={`mt-1 min-w-0 text-sm font-semibold text-white ${alignClass(primaryColumn.align)} ${primaryColumn.className ?? ''}`}>
                  {primaryColumn.cell(row)}
                </div>
              </>
            )}
          </div>

          {canClick && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/3 text-slate-500">
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </div>
          )}
        </div>

        {secondaryColumn && (
          <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{secondaryColumn.header}</p>
            <div className={`mt-1 text-sm text-slate-300 ${alignClass(secondaryColumn.align)} ${secondaryColumn.className ?? ''}`}>
              {secondaryColumn.cell(row)}
            </div>
          </div>
        )}

        {detailColumns.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {detailColumns.map((column) => (
              <div key={column.id} className="rounded-xl border border-white/5 bg-white/[3 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{column.header}</p>
                <div className={`mt-1 text-sm ${alignClass(column.align)} ${column.className ?? ''}`}>{column.cell(row)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    if (canClick) {
      return (
        <button
          key={rowId}
          type="button"
          onClick={() => onRowClick?.(row)}
          className="w-full rounded-2xl border border-white/5 bg-white/[3 p-4 text-left transition-all duration-200 hover:border-white/10 hover:bg-white/[0.05] active:scale-[0.995]"
        >
          {content}
        </button>
      );
    }

    return (
      <div key={rowId} className="rounded-2xl border border-white/5 bg-white/[3 p-4">
        {content}
      </div>
    );
  };

  return (
    <div className="overflow-hidden ">
      <div className="md:hidden">
        <div className="border-b border-white/5 bg-black/20 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className={` ${activeSortColumn ? '' : 'flex items-center gap-2'}`}>
              <p className="text-sm font-bold text-white">Records</p>
              <p className="text-xs text-slate-500">
                {sorted.length} item{sorted.length === 1 ? '' : 's'}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-white/[3 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
              {activeSortColumn && <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.75} />}
              {activeSortColumn && activeSortColumn.header}
            </div>
          </div>

          {sortableColumns.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSort(null)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${!sort
                    ? 'border-white/15 bg-white/10 text-white'
                    : 'border-white/5 bg-white/[3 text-slate-400 hover:border-white/10 hover:text-white'
                  }`}
              >
                <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                Default
              </button>

              {sortableColumns.map((column) => {
                const active = sort?.columnId === column.id;
                const dir = active ? sort?.dir : undefined;

                return (
                  <button
                    key={column.id}
                    type="button"
                    onClick={() => setSortFor(column.id)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${active
                        ? 'border-white/15 bg-white/10 text-white'
                        : 'border-white/5 bg-white/[3 text-slate-400 hover:border-white/10 hover:text-white'
                      }`}
                  >
                    {getSortIcon(active, dir)}
                    {column.header}
                  </button>
                );
              })}
            </div>
          )}
        </div>
              {/* <div className="hidden md:block">> */}


        <div className="space-y-3 p-3">
          {sorted.length === 0 ? renderEmptyState() : sorted.map(renderMobileRow)}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="sticky top-0 z-10 border-b border-white/5 bg-black/60 backdrop-blur">
              <tr>
                {columns.map((column) => {
                  const sortable = Boolean(column.sortValue);
                  const active = sort?.columnId === column.id;

                  return (
                    <th
                      key={column.id}
                      scope="col"
                      className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 ${alignClass(column.align)}`}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => setSortFor(column.id)}
                          className={`inline-flex items-center gap-1 transition-colors hover:text-slate-300 ${alignClass(column.align)}`}
                          aria-label={`Sort by ${column.header}`}
                          aria-pressed={active}
                        >
                          <span>{column.header}</span>
                          {getSortIcon(active, active ? sort?.dir : undefined)}
                        </button>
                      ) : (
                        <span>{column.header}</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-500">
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                sorted.map((row) => {
                  const rowId = getRowId(row);

                  return (
                    <tr
                      key={rowId}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={onRowClick ? 'cursor-pointer transition-colors hover:bg-white/4' : ''}
                    >
                      {columns.map((column) => (
                        <td key={column.id} className={`px-4 py-3 text-sm ${alignClass(column.align)} ${column.className ?? ''}`}>
                          {column.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}