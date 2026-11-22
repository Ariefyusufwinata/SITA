import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LOGBOOK_STATUS_LABELS, ROLE_LABELS } from "@sita/shared";
import { client, unwrap } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Progress, StatusBadge } from "@/components/ui";
import { useMe } from "@/components/Layout";

export function DashboardPage() {
  const { data: me } = useMe();
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => unwrap(client.api.v1.dashboard.$get()) });
  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Memuat…</p>;
  if (error || !data) return <p className="text-sm text-destructive p-4">Gagal memuat dashboard.</p>;
  const isStudent = data.role === "MAHASISWA";
  const stats = [
    { label: "Disetujui", value: data.counts.disetujui, color: "text-emerald-600" },
    { label: "Menunggu", value: data.counts.menunggu, color: "text-amber-600" },
    { label: "Perlu Revisi", value: data.counts.perluRevisi, color: "text-rose-600" },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-6xl">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Dashboard {ROLE_LABELS[data.role]}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Selamat datang, {me?.name}. {data.scopeLabel}.</p>
      </div>

      {/* Grid Statistik Responsif (1 kolom di HP kecil, 3 di tablet/desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 sm:p-5">
              <div className="text-xs sm:text-sm text-muted-foreground font-medium">Bimbingan {s.label}</div>
              <div className={`text-3xl sm:text-4xl font-bold mt-1 ${s.color}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress Target Semester */}
      <Card>
        <CardHeader className="p-4 sm:p-5 pb-2">
          <CardTitle className="text-base sm:text-lg">Pencapaian Target Semester</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-2">
          <div className="mb-2 flex items-center justify-between text-xs sm:text-sm">
            <span>{data.counts.disetujui} dari {data.target} bimbingan disetujui</span>
            <span className="font-bold text-primary">{data.percent}%</span>
          </div>
          <Progress value={data.percent} />
          {isStudent && <p className="mt-2 text-[11px] sm:text-xs text-muted-foreground">Draft ({data.counts.draft}) tidak dihitung dalam target capaian.</p>}
        </CardContent>
      </Card>

      {/* Daftar Tugas Responsif */}
      <Card>
        <CardHeader className="p-4 sm:p-5 pb-2">
          <CardTitle className="text-base sm:text-lg">{isStudent ? "Tugas Saya" : "Antrean Terbaru"}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-2">
          {data.tasks.length === 0 && <p className="text-xs sm:text-sm text-muted-foreground py-2">Tidak ada tugas saat ini.</p>}
          <ul className="divide-y divide-border">
            {data.tasks.map((t) => (
              <li key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate">{t.topic}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.studentName} ({t.nim}) · {fmtDate(t.sessionDate)}</div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <StatusBadge status={t.status} label={LOGBOOK_STATUS_LABELS[t.status]} />
                  {isStudent ? (
                    <Link className="text-xs sm:text-sm font-semibold text-primary hover:underline px-2 py-1 rounded bg-muted/40 sm:bg-transparent" to="/logbook/$logbookId/edit" params={{ logbookId: t.id }}>
                      Buka
                    </Link>
                  ) : (
                    <Link className="text-xs sm:text-sm font-semibold text-primary hover:underline px-2 py-1 rounded bg-muted/40 sm:bg-transparent" to="/validasi">
                      Tinjau
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
