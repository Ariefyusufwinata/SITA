import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { evaluationSchema } from "@sita/shared";
import { client, downloadAttachment, unwrap } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { Button, Card, CardContent, CardHeader, CardTitle, FieldError, Label, Select, Textarea } from "@/components/ui";

type FormValues = import("zod").input<typeof evaluationSchema>;
const SCORES = [1, 2, 3, 4, 5];

export function ValidationQueuePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data = [], isLoading, error } = useQuery({ queryKey: ["queue"], queryFn: () => unwrap(client.api.v1.evaluations.queue.$get()) });
  const selected = data.find((d) => d.id === selectedId);

  return (
    <div className="flex flex-col gap-4 sm:gap-5 max-w-6xl">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Antrean Validasi Logbook</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Penilaian dan pemberian umpan balik bimbingan mahasiswa.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="shadow-xs h-fit">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center justify-between">
              <span>Menunggu Validasi</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {data.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2">
            {isLoading && <p className="text-xs sm:text-sm text-muted-foreground">Memuat antrean…</p>}
            {error && <p className="text-xs sm:text-sm text-destructive">{error.message}</p>}
            {!isLoading && data.length === 0 && <p className="text-xs sm:text-sm text-muted-foreground py-3">Antrean kosong, seluruh bimbingan telah divalidasi 🎉</p>}
            <ul className="flex flex-col gap-2">
              {data.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-all ${
                      l.id === selectedId
                        ? "border-primary bg-red-50/50 shadow-xs"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-semibold text-xs sm:text-sm text-foreground line-clamp-1">{l.topic}</div>
                    <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                      {l.studentName} ({l.nim}) · {fmtDate(l.sessionDate)} · <span className="font-mono">v{l.version}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {selected ? (
          <EvaluationPanel key={selected.id} item={selected} onDone={() => setSelectedId(null)} />
        ) : (
          <Card className="shadow-xs">
            <CardContent className="p-8 text-center text-xs sm:text-sm text-muted-foreground">
              Pilih salah satu logbook dari daftar antrean di samping untuk mulai memeriksa dan memberi evaluasi.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function EvaluationPanel({
  item,
  onDone,
}: {
  item: {
    id: string;
    topic: string;
    studentName: string;
    nim: string;
    thesisTitle: string;
    progress: string;
    challenges: string;
    nextSteps: string;
    attachmentName: string | null;
    attachmentKey: string | null;
    version: number;
  };
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (v: FormValues) => unwrap(client.api.v1.evaluations.$post({ json: v as any })),
    onSuccess: () => {
      qc.invalidateQueries();
      onDone();
    },
  });

  const form = useForm({
    defaultValues: {
      logbookId: item.id,
      researchProgressScore: 3,
      scheduleComplianceScore: 3,
      onTimeCompletionScore: 3,
      comments: "",
      decision: "DISETUJUI",
    } as FormValues,
    validators: { onSubmit: evaluationSchema as any },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
    },
  });

  const decide = (d: "DISETUJUI" | "PERLU_REVISI") => {
    form.setFieldValue("decision", d);
    form.handleSubmit();
  };

  const scoreField = (name: "researchProgressScore" | "scheduleComplianceScore" | "onTimeCompletionScore", label: string) => (
    <form.Field name={name}>
      {(f) => (
        <div>
          <Label className="text-xs sm:text-sm font-medium">{label}</Label>
          <Select className="mt-1 text-xs sm:text-sm" value={f.state.value} onChange={(e) => f.handleChange(Number(e.target.value))}>
            {SCORES.map((s) => (
              <option key={s} value={s}>{s} - {s === 5 ? "Sangat Baik" : s === 4 ? "Baik" : s === 3 ? "Cukup" : s === 2 ? "Kurang" : "Sangat Kurang"}</option>
            ))}
          </Select>
        </div>
      )}
    </form.Field>
  );

  return (
    <Card className="shadow-xs">
      <CardHeader className="p-4 sm:p-5 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg">{item.topic}</CardTitle>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted">v{item.version}</span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          <span className="font-semibold text-foreground">{item.studentName}</span> ({item.nim}) — {item.thesisTitle}
        </p>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 pt-2 flex flex-col gap-4">
        {/* Info Detail Ringkasan */}
        <dl className="grid gap-2.5 rounded-lg bg-muted/30 border border-border p-3.5 text-xs sm:text-sm">
          <div>
            <dt className="font-semibold text-foreground">Progres yang Dicapai:</dt>
            <dd className="text-muted-foreground mt-0.5 leading-relaxed">{item.progress}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Kendala:</dt>
            <dd className="text-muted-foreground mt-0.5 leading-relaxed">{item.challenges || "-"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Rencana Tindak Lanjut:</dt>
            <dd className="text-muted-foreground mt-0.5 leading-relaxed">{item.nextSteps || "-"}</dd>
          </div>
          {item.attachmentKey && (
            <div>
              <dt className="font-semibold text-foreground">Berkas Lampiran:</dt>
              <dd className="mt-1">
                <button
                  type="button"
                  className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                  onClick={() => downloadAttachment(item.attachmentKey!, item.attachmentName!)}
                >
                  📎 {item.attachmentName}
                </button>
              </dd>
            </div>
          )}
        </dl>

        {/* Form Penilaian & Keputusan */}
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            {scoreField("researchProgressScore", "Research Progress (1–5)")}
            {scoreField("scheduleComplianceScore", "Schedule Compliance (1–5)")}
            {scoreField("onTimeCompletionScore", "On-time Completion (1–5)")}
          </div>

          <form.Field name="comments">
            {(f) => (
              <div>
                <Label className="text-xs sm:text-sm">
                  Catatan & Komentar Pembimbing <span className="text-[11px] text-muted-foreground">(wajib jika meminta revisi)</span>
                </Label>
                <Textarea
                  rows={4}
                  className="mt-1 text-xs sm:text-sm"
                  placeholder="Tuliskan arahan revisi atau evaluasi untuk mahasiswa..."
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
                <FieldError errors={f.state.meta.errors} />
              </div>
            )}
          </form.Field>

          {save.error && <p className="text-xs sm:text-sm text-destructive">{save.error.message}</p>}

          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(busy) => (
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                <Button type="button" variant="destructive" className="w-full sm:w-auto h-9 text-xs sm:text-sm" disabled={busy} onClick={() => decide("PERLU_REVISI")}>
                  Minta Perbaikan (Revisi)
                </Button>
                <Button type="button" variant="success" className="w-full sm:w-auto h-9 text-xs sm:text-sm" disabled={busy} onClick={() => decide("DISETUJUI")}>
                  Setujui Logbook
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
