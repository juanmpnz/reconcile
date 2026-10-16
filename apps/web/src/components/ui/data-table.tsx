import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type {
  ColumnDef,
  PaginationState,
  SortingState,
} from '@tanstack/react-table';
import { Button, TableRegion } from './primitives';
import { Loading } from './loading';
import './data-table.css';
export type TableColumn<T> = {
  id: string;
  label: string;
  accessor?: (row: T) => string | number | boolean | null | undefined;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  size?: number;
};
type DataTableBaseProps<T> = {
  label: string;
  data: T[];
  columns: TableColumn<T>[];
  getRowId: (row: T) => string;
  mode?: 'client' | 'server';
  pagination?: PaginationState;
  rowCount?: number;
  onPaginationChange?: (next: PaginationState) => void;
  sorting?: SortingState;
  onSortingChange?: (next: SortingState) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchLabel?: string;
  searchHint?: string;
  emptyMessage?: string;
  disabled?: boolean;
  busy?: boolean;
  pageSizes?: number[];
  columnVisibility?: boolean;
  columnResizing?: boolean;
  columnPinning?: boolean;
  selection?: {
    ids: Record<string, boolean>;
    onChange: (ids: Record<string, boolean>) => void;
  };
  expandedContent?: (row: T) => ReactNode;
  toolbar?: ReactNode;
};
export type DataTableProps<T> = DataTableBaseProps<T> &
  (
    | { mode?: 'client' }
    | {
        mode: 'server';
        pagination: PaginationState;
        rowCount: number;
        onPaginationChange: (next: PaginationState) => void;
      }
  );
export function DataTable<T>({
  label,
  data,
  columns,
  getRowId,
  mode = 'client',
  pagination,
  onPaginationChange,
  rowCount,
  sorting,
  onSortingChange,
  search,
  onSearchChange,
  searchLabel = 'Buscar',
  searchHint,
  emptyMessage = 'No hay resultados.',
  disabled = false,
  busy = false,
  pageSizes = [25, 50, 100],
  columnVisibility = false,
  columnResizing = false,
  columnPinning = false,
  selection,
  expandedContent,
  toolbar,
}: DataTableProps<T>) {
  const id = useId();
  const [localPagination, setLocalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [localSorting, setLocalSorting] = useState<SortingState>([]);
  const [localSearch, setLocalSearch] = useState('');
  const [draft, setDraft] = useState(search ?? '');
  useEffect(() => setDraft(search ?? ''), [search]);
  const currentPagination = pagination ?? localPagination;
  const currentSorting = sorting ?? localSorting;
  const setPagination = onPaginationChange ?? setLocalPagination;
  const setSorting = onSortingChange ?? setLocalSorting;
  const defs = useMemo<ColumnDef<T>[]>(() => {
    const result: ColumnDef<T>[] = columns.map((column) => ({
      id: column.id,
      header: column.label,
      accessorFn: column.accessor ?? (() => ''),
      enableGlobalFilter: Boolean(column.accessor),
      cell: ({ row }) =>
        column.render
          ? column.render(row.original)
          : renderString(column.accessor?.(row.original)),
      enableSorting:
        (mode === 'client' || Boolean(onSortingChange)) &&
        (column.sortable ?? Boolean(column.accessor)),
      size: column.size ?? 180,
    }));
    if (selection)
      result.unshift({
        id: '__select',
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Seleccionar página"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Seleccionar fila ${row.index + 1}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 48,
      });
    if (expandedContent)
      result.unshift({
        id: '__expand',
        header: 'Detalle',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            aria-expanded={row.getIsExpanded()}
            onClick={row.getToggleExpandedHandler()}
          >
            {row.getIsExpanded() ? 'Ocultar' : 'Ver detalle'}
          </Button>
        ),
        enableSorting: false,
        enableHiding: false,
      });
    return result;
  }, [columns, selection, expandedContent, mode, onSortingChange]);
  const table = useReactTable({
    data,
    columns: defs,
    getRowId,
    state: {
      pagination: currentPagination,
      sorting: currentSorting,
      globalFilter: mode === 'client' ? localSearch : search,
      ...(selection ? { rowSelection: selection.ids } : {}),
    },
    onPaginationChange: (update) =>
      setPagination(
        typeof update === 'function' ? update(currentPagination) : update,
      ),
    onSortingChange: (update) => {
      setSorting(
        typeof update === 'function' ? update(currentSorting) : update,
      );
      if (mode === 'client')
        setPagination({ ...currentPagination, pageIndex: 0 });
    },
    onGlobalFilterChange: setLocalSearch,
    enableSortingRemoval: false,
    enableMultiSort: false,
    manualPagination: mode === 'server',
    manualSorting: mode === 'server',
    manualFiltering: mode === 'server',
    ...(mode === 'server' ? { rowCount: rowCount ?? 0 } : {}),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableRowSelection: Boolean(selection),
    onRowSelectionChange: (update) =>
      selection?.onChange(
        typeof update === 'function' ? update(selection.ids) : update,
      ),
    getRowCanExpand: () => Boolean(expandedContent),
    enableColumnResizing: columnResizing,
    columnResizeMode: 'onChange',
    enableColumnPinning: columnPinning,
  });
  const count =
    mode === 'server'
      ? (rowCount ?? 0)
      : table.getFilteredRowModel().rows.length;
  const canSearch = mode === 'client' || Boolean(onSearchChange);
  return (
    <div className="data-table" aria-busy={busy}>
      <div className="data-table-toolbar">
        {canSearch && (
          <form
            className="data-table-search"
            onSubmit={(event) => {
              event.preventDefault();
              const value = draft.trim();
              if (mode === 'server') onSearchChange?.(value);
              else {
                setLocalSearch(value);
                setPagination({ ...currentPagination, pageIndex: 0 });
              }
            }}
          >
            <label htmlFor={id}>{searchLabel}</label>
            <div>
              <input
                id={id}
                type="search"
                maxLength={200}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={disabled}
                aria-describedby={searchHint ? `${id}-hint` : undefined}
              />
              <Button variant="outline" disabled={disabled}>
                Buscar
              </Button>
              {(search || localSearch) && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setDraft('');
                    if (mode === 'server') onSearchChange?.('');
                    else {
                      setLocalSearch('');
                      setPagination({ ...currentPagination, pageIndex: 0 });
                    }
                  }}
                >
                  Limpiar búsqueda
                </Button>
              )}
            </div>
            {searchHint && <small id={`${id}-hint`}>{searchHint}</small>}
          </form>
        )}
        {toolbar}
        {columnVisibility && (
          <details className="data-table-columns">
            <summary>Columnas</summary>
            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <label key={column.id}>
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                  />
                  {String(column.columnDef.header)}
                </label>
              ))}
          </details>
        )}
      </div>
      <p className="metadata" role="status">
        {count} resultados
        {currentSorting[0]
          ? ` · orden ${columns.find((column) => column.id === currentSorting[0]?.id)?.label ?? ''}, ${currentSorting[0].desc ? 'descendente' : 'ascendente'}`
          : ''}
      </p>
      <TableRegion label={label}>
        <table
          style={columnResizing ? { width: table.getTotalSize() } : undefined}
        >
          <caption className="sr-only">{label}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      header.column.getIsSorted() === 'asc'
                        ? 'ascending'
                        : header.column.getIsSorted() === 'desc'
                          ? 'descending'
                          : 'none'
                    }
                    style={
                      columnResizing
                        ? { width: header.getSize(), position: 'relative' }
                        : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <button
                        className="table-sort"
                        type="button"
                        disabled={disabled}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <span aria-hidden="true">
                          {header.column.getIsSorted() === 'asc'
                            ? ' ↑'
                            : header.column.getIsSorted() === 'desc'
                              ? ' ↓'
                              : ' ↕'}
                        </span>
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                    {columnPinning && header.column.getCanPin() && (
                      <button
                        type="button"
                        className="table-pin"
                        aria-label={`${header.column.getIsPinned() ? 'Liberar' : 'Fijar'} ${String(header.column.columnDef.header)}`}
                        onClick={() =>
                          header.column.pin(
                            header.column.getIsPinned() ? false : 'left',
                          )
                        }
                      >
                        {header.column.getIsPinned() ? 'Liberar' : 'Fijar'}
                      </button>
                    )}
                    {columnResizing && (
                      <span
                        role="separator"
                        aria-label={`Ancho ${String(header.column.columnDef.header)}`}
                        aria-orientation="vertical"
                        tabIndex={0}
                        className="table-resizer"
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'ArrowLeft' ||
                            event.key === 'ArrowRight'
                          ) {
                            event.preventDefault();
                            table.setColumnSizing((previous) => ({
                              ...previous,
                              [header.column.id]: Math.max(
                                60,
                                header.getSize() +
                                  (event.key === 'ArrowRight' ? 20 : -20),
                              ),
                            }));
                          }
                        }}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                row={row}
                expandedContent={expandedContent}
              />
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableRegion>
      <div className="pagination data-table-pagination">
        <label>
          Filas por página{' '}
          <select
            value={currentPagination.pageSize}
            disabled={disabled || busy}
            onChange={(event) =>
              table.setPagination({
                pageIndex: 0,
                pageSize: Number(event.target.value),
              })
            }
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span className="metadata">
          {count
            ? `${Math.min(currentPagination.pageIndex * currentPagination.pageSize + 1, count)}–${Math.min((currentPagination.pageIndex + 1) * currentPagination.pageSize, count)} de ${count}`
            : '0 resultados'}
        </span>
        <div>
          <Button
            variant="outline"
            disabled={disabled || busy || !table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Anterior
          </Button>
          <span className="metadata">
            Página {currentPagination.pageIndex + 1} de{' '}
            {Math.max(1, table.getPageCount())}
          </span>
          <Button
            variant="outline"
            disabled={disabled || busy || !table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Siguiente
          </Button>
        </div>
      </div>
      {busy && <Loading inline label="Actualizando datos…" />}
    </div>
  );
}
import type { Row } from '@tanstack/react-table';
function TableRow<T>({
  row,
  expandedContent,
}: {
  row: Row<T>;
  expandedContent: ((row: T) => ReactNode) | undefined;
}) {
  return (
    <>
      <tr>
        {row.getVisibleCells().map((cell) => (
          <td
            key={cell.id}
            style={
              cell.column.getIsPinned()
                ? {
                    position: 'sticky',
                    left: cell.column.getStart('left'),
                    background: 'var(--surface, white)',
                    zIndex: 1,
                  }
                : undefined
            }
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
      {row.getIsExpanded() && expandedContent && (
        <tr>
          <td colSpan={row.getVisibleCells().length}>
            {expandedContent(row.original)}
          </td>
        </tr>
      )}
    </>
  );
}
export function renderString(value: unknown) {
  return value == null || value === '' ? '—' : String(value);
}
export function renderNumber(value: number | null | undefined) {
  return value == null
    ? '—'
    : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 4 }).format(
        value,
      );
}
export function renderCurrency(
  value: string | null | undefined,
  currency: string,
) {
  return value == null ? '—' : `${value} ${currency}`;
}
export function renderDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
}
export function renderStatus(
  label: string,
  tone: 'neutral' | 'success' | 'warning' | 'danger' = 'neutral',
) {
  return <span className={`table-status table-status-${tone}`}>{label}</span>;
}
export function renderBar(value: number, max: number, label: string) {
  return (
    <span className="table-bar">
      <meter min={0} max={Math.max(1, max)} value={value} aria-label={label} />
      <span>{renderNumber(value)}</span>
    </span>
  );
}
export function renderLink(
  label: string,
  href: string,
  onNavigate?: (href: string) => void,
) {
  return (
    <a
      href={href}
      onClick={(event) => {
        if (
          onNavigate &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          event.button === 0
        ) {
          event.preventDefault();
          onNavigate(href);
        }
      }}
    >
      {label}
    </a>
  );
}
export function renderActions(actions: ReactNode) {
  return <div className="document-row-actions">{actions}</div>;
}
