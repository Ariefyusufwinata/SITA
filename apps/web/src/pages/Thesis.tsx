import { useQuery } from "@tanstack/react-query";
import { PROPOSAL_STAGES, THESIS_STAGES, THESIS_STAGE_LABELS } from "@sita/shared";
import { client, unwrap } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useMe } from "@/components/Layout";

type T = {
  id: string;
  title: string;
  stage: (typeof THESIS_STAGES)[number];
  status: string;
  program: string;
  term: string;
  student: { name: string; nim: string; email: string; cohortYear: number; phone: string | null };
  supervisors: { lecturerId: string; name: string; nip: string; type: string; expertise: string | null }[];
};

function ThesisCard({ t }: { t: T }) {
  const idx = PROPOSAL_STAGES.indexOf(t.stage as any);
  return (
    <div className="flex flex-col gap-4 sm:gap-5 max-w-5xl">
      <Card>
        <CardHeader className="p-4 sm:p-5 pb-2">
          <CardTitle className="text-base sm:text-lg">Judul Tesis</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-2">
          <p className="text-base sm:text-lg font-semibold text-foreground leading-snug">{t.title}</p>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">{t.program} · Semester {t.term} · Status <span className="font-medium text-foreground">{t.status}</span></p>
        </CardContent>
      </Card>

      {/* Tahapan Tesis (Skup Proposal: 3 Tahap) */}
      <Card>
        <CardHeader className="p-4 sm:p-5 pb-2">
          <CardTitle className="text-base sm:text-lg">Tahap Saat Ini</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-2">
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PROPOSAL_STAGES.map((s, i) => (
              <li
                key={s}
                className={cn(
                  "rounded-md border px-3 py-2.5 text-center text-xs sm:text-sm transition-all",
                  idx !== -1 && i < idx && "bg-emerald-50 border-emerald-200 text-emerald-800 font-medium",
                  i === idx && "bg-primary border-primary text-primary-foreground font-semibold shadow-xs",
                  (idx === -1 || i > idx) && "border-border text-muted-foreground bg-muted/20"
                )}
              >
                {THESIS_STAGE_LABELS[s]}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Identitas & Pembimbing Responsif */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-base sm:text-lg">Identitas Mahasiswa</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2">
            <dl className="grid grid-cols-[90px_1fr] sm:grid-cols-[110px_1fr] gap-y-2 text-xs sm:text-sm">
              <dt className="text-muted-foreground font-medium">Nama</dt>
              <dd className="font-semibold text-foreground">{t.student.name}</dd>
              <dt className="text-muted-foreground font-medium">NIM</dt>
              <dd className="font-mono">{t.student.nim}</dd>
              <dt className="text-muted-foreground font-medium">Email</dt>
              <dd className="break-all">{t.student.email}</dd>
              <dt className="text-muted-foreground font-medium">Angkatan</dt>
              <dd>{t.student.cohortYear}</dd>
              <dt className="text-muted-foreground font-medium">Telepon</dt>
              <dd>{t.student.phone ?? "-"}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-base sm:text-lg">Dosen Pembimbing Aktif</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2 flex flex-col gap-3">
            {t.supervisors.map((s) => (
              <div key={s.lecturerId} className="rounded-md border border-border p-3 bg-muted/20 text-xs sm:text-sm">
                <div className="font-semibold text-foreground">{s.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-primary">{s.type.replace("_", " ")}</span> · NIP {s.nip}
                </div>
                {s.expertise && <div className="mt-1 text-[11px] sm:text-xs text-muted-foreground italic">Bidang: {s.expertise}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ThesisPage() {
  const { data: me } = useMe();
  const isStudent = me?.role === "MAHASISWA";
  const q = useQuery({
    queryKey: ["thesis", me?.role],
    enabled: !!me,
    queryFn: async () => (isStudent ? [await unwrap(client.api.thesis.me.$get())] : await unwrap(client.api.thesis.$get())) as T[],
  });

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-6xl">
      <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Profil Tesis</h1>
      {q.isLoading && <p className="text-sm text-muted-foreground">Memuat data tesis…</p>}
      {q.error && <p className="text-sm text-destructive">{q.error.message}</p>}
      {q.data?.map((t) => <ThesisCard key={t.id} t={t} />)}
    </div>
  );
}
