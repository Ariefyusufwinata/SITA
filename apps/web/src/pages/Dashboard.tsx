import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Presentation,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";
import { LOGBOOK_STATUS_LABELS, PROPOSAL_STAGES, ROLE_LABELS, THESIS_STAGES, THESIS_STAGE_LABELS } from "@sita/shared";
import { client, unwrap } from "@/lib/api";
import { cn, fmtDate } from "@/lib/utils";
import { Button, Card, CardContent, CardHeader, CardTitle, Progress, StatusBadge } from "@/components/ui";
import { useMe } from "@/components/Layout";

export function DashboardPage() {
  const { data: me } = useMe();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => unwrap(client.api.dashboard.$get()),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Memuat dashboard…</p>;
  if (error || !data) return <p className="text-sm text-destructive p-4">Gagal memuat dashboard.</p>;

  const isStudent = data.role === "MAHASISWA";
  const thesis = data.thesis;
  const lecturer = data.lecturer;
  const stageDist = data.stageDistribution ?? {};

  // Indeks tahapan saat ini untuk mapping visual dinamis (skup proposal: 3 tahap)
  const currentStageIdx = thesis?.stage ? PROPOSAL_STAGES.indexOf(thesis.stage as any) : -1;

  const stats = [
    { label: "Disetujui", value: data.counts.disetujui, color: "text-emerald-600", bg: "bg-emerald-50/70 border-emerald-200/60" },
    { label: "Menunggu", value: data.counts.menunggu, color: "text-amber-600", bg: "bg-amber-50/70 border-amber-200/60" },
    { label: "Perlu Revisi", value: data.counts.perluRevisi, color: "text-rose-600", bg: "bg-rose-50/70 border-rose-200/60" },
  ];

  return (
    <div className="flex flex-col gap-5 sm:gap-6 w-full max-w-[1400px] mx-auto">
      {/* Header Dashboard Responsif */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="text-primary h-6 w-6" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard {ROLE_LABELS[data.role]}</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Selamat datang kembali, <strong className="text-foreground">{me?.name}</strong>. {data.scopeLabel}.
          </p>
        </div>

        {isStudent && (
          <div className="flex items-center gap-2">
            {!thesis ? (
              <Button asChild size="sm" className="gap-1.5 text-xs">
                <Link to="/topik">
                  <Compass size={14} /> Pilih Topik Riset
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                <Link to="/logbook/baru">
                  <BookOpen size={14} /> Catat Bimbingan
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Layout Grid 2 Kolom Lebar (Memaksimalkan Sisi Kanan & Kiri) */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* KOLOM KIRI (Profil, Tahapan Tesis, & Metrik Bimbingan) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5">
          {/* TAMPILAN PROFIL MAHASISWA & TAHAPAN TESIS */}
          {isStudent ? (
            thesis ? (
              <Card className="shadow-xs border-border">
                <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/70">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      {thesis.program} · {thesis.term}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Status: {thesis.status}
                    </span>
                  </div>
                  <CardTitle className="text-base sm:text-lg font-bold text-foreground mt-2 leading-snug">
                    {thesis.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 pt-4 flex flex-col gap-4">
                  {/* TAHAP SAAT INI (Mapping Dinamis Kondisi Mahasiswa) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap size={15} className="text-primary" /> Tahap Saat Ini:
                      </span>
                      <span className="text-xs font-bold text-primary">
                        {(THESIS_STAGE_LABELS as any)[thesis.stage] ?? thesis.stage}
                      </span>
                    </div>

                    <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {PROPOSAL_STAGES.map((stg, i) => {
                        const isPast = currentStageIdx !== -1 && i < currentStageIdx;
                        const isCurrent = i === currentStageIdx;

                        return (
                          <li
                            key={stg}
                            className={cn(
                              "rounded-lg border px-3 py-2.5 text-center text-xs transition-all flex flex-col items-center justify-center gap-1",
                              isPast && "bg-emerald-50/80 border-emerald-300 text-emerald-800 font-semibold shadow-2xs",
                              isCurrent && "bg-primary border-primary text-primary-foreground font-bold shadow-xs",
                              !isPast && !isCurrent && "border-border text-muted-foreground bg-muted/20"
                            )}
                          >
                            <span className="truncate w-full font-medium">{THESIS_STAGE_LABELS[stg]}</span>
                            {isPast && <CheckCircle2 size={13} className="text-emerald-700" />}
                            {isCurrent && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Aktif</span>}
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  {/* Ringkasan Dosen Pembimbing */}
                  <div className="pt-2 border-t border-border/70">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                      Dosen Pembimbing Tugas Akhir:
                    </span>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {thesis.supervisors?.map((sp: any, idx: number) => (
                        <div key={idx} className="rounded-lg border border-border p-3 bg-muted/20 text-xs">
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            <UserCheck size={14} className="text-primary" /> {sp.name}
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            <span className="font-semibold text-primary">{sp.type.replace("_", " ")}</span> · NIP: {sp.nip}
                          </div>
                          {sp.expertise && (
                            <div className="text-[11px] text-muted-foreground italic mt-0.5 truncate">
                              Bidang: {sp.expertise}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Mahasiswa Belum Memiliki Topik (Seperti Akun Baru Rizky Pratama) */
              <Card className="shadow-xs border-dashed border-primary/40 bg-primary/5 p-6 text-center">
                <Compass className="h-10 w-10 text-primary mx-auto mb-2 opacity-80" />
                <h3 className="text-base font-bold text-foreground">Anda Belum Memilih Topik Riset Tesis</h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1">
                  Saat ini akun Anda berada pada tahap persiapan. Silakan pilih topik riset yang disediakan dosen pada katalog Topic Shopping atau ajukan topik mandiri Anda.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                  <Button asChild size="sm" className="gap-1.5 text-xs">
                    <Link to="/topik">
                      <Compass size={14} /> Buka Topic Shopping
                    </Link>
                  </Button>
                </div>
              </Card>
            )
          ) : (
            /* TAMPILAN PROFIL DOSEN PEMBIMBING & DISTRIBUSI MAHASISWA */
            lecturer && (
              <Card className="shadow-xs border-border">
                <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/70">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      Profil Akademik Dosen
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Bimbingan Aktif: {lecturer.activeSupervisees} / {lecturer.quota} Mahasiswa
                    </span>
                  </div>
                  <CardTitle className="text-base sm:text-lg font-bold text-foreground mt-1">
                    {lecturer.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    NIP: {lecturer.nip} · Keahlian: {lecturer.expertise ?? "Digital Forensics & Cybersecurity"}
                  </p>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 pt-4">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                    Distribusi Tahapan Mahasiswa Bimbingan Anda:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {PROPOSAL_STAGES.map((stg) => {
                      const count = stageDist[stg] ?? 0;
                      return (
                        <div key={stg} className="rounded-lg border border-border p-3 text-center bg-muted/20">
                          <div className="text-xs font-semibold text-muted-foreground truncate">{THESIS_STAGE_LABELS[stg]}</div>
                          <div className="text-xl font-bold text-primary mt-1">{count}</div>
                          <div className="text-[10px] text-muted-foreground">Mahasiswa</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          )}

          {/* Grid Statistik Bimbingan (3 Kartu Metrik) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {stats.map((s) => (
              <Card key={s.label} className={cn("shadow-xs border", s.bg)}>
                <CardContent className="p-4 sm:p-5">
                  <div className="text-xs sm:text-sm text-muted-foreground font-semibold">Bimbingan {s.label}</div>
                  <div className={`text-3xl sm:text-4xl font-extrabold mt-1 ${s.color}`}>{s.value}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Sesi logbook tercatat</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* KOLOM KANAN (Target Semester & Antrean Tugas - Mengisi Area yang Kosong) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
          {/* Target Capaian Semester */}
          <Card className="shadow-xs border-border">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                <span>Pencapaian Target</span>
                <span className="text-xs font-bold text-primary">{data.percent}%</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-2">
              <div className="mb-2 flex items-center justify-between text-xs sm:text-sm">
                <span>{data.counts.disetujui} dari {data.target} bimbingan disetujui</span>
                <span className="font-mono text-muted-foreground text-xs">Target: {data.target}</span>
              </div>
              <Progress value={data.percent} />
              <p className="mt-2.5 text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                {isStudent
                  ? `Minimal 4 bimbingan disetujui untuk mendaftar Seminar Proposal. Capaian saat ini: ${data.counts.disetujui} sesi.`
                  : `Target bimbingan semester berjalan: ${data.target} sesi per mahasiswa.`}
              </p>
            </CardContent>
          </Card>

          {/* Antrean / Tugas Terbaru */}
          <Card className="shadow-xs border-border flex-1">
            <CardHeader className="p-4 sm:p-5 pb-2 border-b border-border/70">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                <span>{isStudent ? "Tugas & Riwayat Saya" : "Antrean Validasi Terbaru"}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {data.tasks.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-2">
              {data.tasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <CheckCircle2 size={24} className="mx-auto mb-1.5 text-emerald-600 opacity-80" />
                  Tidak ada tugas atau antrean yang tertunda saat ini.
                </div>
              ) : (
                <ul className="divide-y divide-border/70">
                  {data.tasks.map((t) => (
                    <li key={t.id} className="flex flex-col gap-1.5 py-3 text-xs sm:text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-foreground line-clamp-1">{t.topic}</div>
                        <StatusBadge status={t.status} label={LOGBOOK_STATUS_LABELS[t.status]} />
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>{t.studentName} · {fmtDate(t.sessionDate)}</span>
                        {isStudent ? (
                          <Link
                            className="font-bold text-primary hover:underline"
                            to="/logbook/$logbookId/edit"
                            params={{ logbookId: t.id }}
                          >
                            Buka
                          </Link>
                        ) : (
                          <Link className="font-bold text-primary hover:underline" to="/validasi">
                            Validasi
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Quick Shortcuts */}
          <Card className="shadow-xs border-border p-4 bg-muted/15">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2.5">
              Alur Tahapan Akademik:
            </span>
            <div className="flex flex-col gap-2">
              <Link
                to="/topik"
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted text-xs font-medium transition-colors"
              >
                <span className="flex items-center gap-2"><Compass size={14} className="text-primary" /> Proposal & Topik</span>
                <span className="text-[11px] text-muted-foreground">Buka ➜</span>
              </Link>
              <Link
                to="/logbook"
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted text-xs font-medium transition-colors"
              >
                <span className="flex items-center gap-2"><BookOpen size={14} className="text-primary" /> Logbook Bimbingan</span>
                <span className="text-[11px] text-muted-foreground">Buka ➜</span>
              </Link>
              <Link
                to="/seminar"
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted text-xs font-medium transition-colors"
              >
                <span className="flex items-center gap-2"><Presentation size={14} className="text-primary" /> Seminar Proposal</span>
                <span className="text-[11px] text-muted-foreground">Buka ➜</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
