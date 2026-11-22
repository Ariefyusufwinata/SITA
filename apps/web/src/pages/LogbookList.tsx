import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import { LOGBOOK_STATUSES, LOGBOOK_STATUS_LABELS } from "@sita/shared";
import { client, downloadAttachment, unwrap } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { Button, Card, Select, StatusBadge } from "@/components/ui";

type Status = (typeof LOGBOOK_STATUSES)[number];

export function LogbookListPage() {
  const [status, setStatus] = useState<Status | "">("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["logbooks", status],
    queryFn: () => unwrap(client.api.v1.logbooks.$get({ query: status ? { status } : {} })),
  });
  type Row = (typeof data)[number];

  const columns = useMemo(() => {
    const h = createColumnHelper<Row>();
    return [
      h.accessor("sessionDate", {
        header: "Tanggal",
        cell: (c) => <span className="whitespace-nowrap font-medium">{fmtDate(c.getValue())}</span>,
      }),
      h.accessor("lecturerName", {
        header: "Pembimbing",
        cell: (c) => <span className="whitespace-nowrap">{c.getValue() ?? "-"}</span>,
      }),
      h.accessor("topic", {
        header: "Topik",
        cell: (c) => <span className="font-medium line-clamp-2">{c.getValue()}</span>,
      }),
      h.accessor("currentVersion", {
        header: "Versi",
        cell: (c) => <span className="font-mono text-center block">v{c.getValue() || 0}</span>,
      }),
      h.accessor("attachmentName", {
        header: "Lampiran",
        enableSorting: false,
        cell: (c) =>
          c.getValue() ? (
            <button
              type="button"
              className="text-primary hover:underline text-xs max-w-[120px] truncate block text-left"
              onClick={() => downloadAttachment(c.row.original.attachmentKey!, c.getValue()!)}
              title={c.getValue()!}
            >
              📎 {c.getValue()}
            </button>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      }),
      h.accessor("status", {
        header: "Status",
        cell: (c) => <StatusBadge status={c.getValue()} label={LOGBOOK_STATUS_LABELS[c.getValue()]} />,
      }),
      h.display({
        id: "aksi",
        header: "Aksi",
        cell: (c) => {
          const s = c.row.original.status;
          return (
            <Button asChild size="sm" variant={s === "PERLU_REVISI" ? "default" : "outline"} className="h-7.5 px-2.5 text-xs">
              <Link to="/logbook/$logbookId/edit" params={{ logbookId: c.row.original.id }}>
                {s === "DRAFT" ? "Edit" : s === "PERLU_REVISI" ? "Revisi" : "Lihat"}
              </Link>
            </Button>
          );
        },
      }),
    ];
  }, []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-4 sm:gap-5 max-w-6xl">
      {/* Header Responsif: Flex-col di HP, Row di Tablet/Desktop */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Logbook Bimbingan</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Catatan konsultasi riset tesis dengan dosen pembimbing.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Select className="w-full sm:w-44 text-xs sm:text-sm h-9" value={status} onChange={(e) => setStatus(e.target.value as Status | "")}>
            <option value="">Semua status</option>
            {LOGBOOK_STATUSES.map((s) => (
              <option key={s} value={s}>{LOGBOOK_STATUS_LABELS[s]}</option>
            ))}
          </Select>
          <Button asChild className="w-full sm:w-auto h-9 text-xs sm:text-sm whitespace-nowrap">
            <Link to="/logbook/baru">+ Tambah Logbook</Link>
          </Button>
        </div>
      </div>

      {/* Tabel dengan Scroll Horizontal Halus di Mobile */}
      <Card className="overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs sm:text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              {table.getHeaderGroups().map((g) => (
                <tr key={g.id}>
                  {g.headers.map((hd) => (
                    <th
                      key={hd.id}
                      className="cursor-pointer select-none px-3.5 py-2.5 font-semibold text-foreground hover:bg-muted/60 transition-colors"
                      onClick={hd.column.getToggleSortingHandler()}
                    >
                      {flexRender(hd.column.columnDef.header, hd.getContext())}
                      {{ asc: " ▲", desc: " ▼" }[hd.column.getIsSorted() as string] ?? ""}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border">
              {table.getRowModel().rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  {r.getVisibleCells().map((c) => (
                    <td key={c.id} className="px-3.5 py-3">
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {!isLoading && data.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs sm:text-sm">
                    Belum ada catatan logbook pada filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {isLoading && <p className="p-4 text-xs sm:text-sm text-muted-foreground">Memuat logbook…</p>}
        {error && <p className="p-4 text-xs sm:text-sm text-destructive">{error.message}</p>}
      </Card>
    </div>
  );
}
