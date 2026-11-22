import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { logbookInputSchema, LOGBOOK_STATUS_LABELS, type LogbookInput } from "@sita/shared";
import { client, unwrap } from "@/lib/api";
import { fmtDateTime, toDateInput } from "@/lib/utils";
import { Button, Card, CardContent, CardHeader, CardTitle, FieldError, Input, Label, Select, StatusBadge, Textarea } from "@/components/ui";

type FormValues = import("zod").input<typeof logbookInputSchema>;

export function LogbookFormPage() {
  const { logbookId } = useParams({ strict: false }) as { logbookId?: string };
  const nav = useNavigate();
  const qc = useQueryClient();
  const supervisors = useQuery({ queryKey: ["supervisors"], queryFn: () => unwrap(client.api.logbooks.supervisors.$get()) });
  const existing = useQuery({
    queryKey: ["logbook", logbookId],
    enabled: !!logbookId,
    queryFn: () => unwrap(client.api.logbooks[":id"].$get({ param: { id: logbookId! } })),
  });

  if (logbookId && existing.isLoading) return <p className="p-4 text-sm text-muted-foreground">Memuat logbook…</p>;
  if (!supervisors.data) return <p className="p-4 text-sm text-muted-foreground">Memuat data pembimbing…</p>;
  return <Inner key={existing.data?.id ?? "new"} logbookId={logbookId} existing={existing.data} supervisors={supervisors.data} nav={nav} qc={qc} />;
}

function Inner({
  logbookId,
  existing,
  supervisors,
  nav,
  qc,
}: {
  logbookId?: string;
  existing?: any;
  supervisors: { lecturerId: string; name: string; type: string }[];
  nav: ReturnType<typeof useNavigate>;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const submitRef = useRef(false);
  const editable = !existing || existing.status === "DRAFT" || existing.status === "PERLU_REVISI";

  const save = useMutation({
    mutationFn: async (v: FormValues & { submit: boolean }) => {
      const json = { ...v, submit: v.submit } as any;
      return logbookId
        ? unwrap(client.api.logbooks[":id"].$put({ param: { id: logbookId }, json }))
        : unwrap(client.api.logbooks.$post({ json }));
    },
    onSuccess: () => {
      qc.invalidateQueries();
      nav({ to: "/logbook" });
    },
  });

  const form = useForm({
    defaultValues: {
      lecturerId: existing?.lecturerId ?? supervisors[0]?.lecturerId ?? "",
      sessionDate: existing ? toDateInput(existing.sessionDate) : toDateInput(new Date()),
      topic: existing?.topic ?? "",
      progress: existing?.progress ?? "",
      challenges: existing?.challenges ?? "",
      nextSteps: existing?.nextSteps ?? "",
      attachmentName: null,
      attachmentKey: null,
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({ ...value, submit: submitRef.current });
    },
  });

  const lastVersion = existing?.versions?.[0];
  const lastEvals = lastVersion?.evaluations ?? [];
  const revisiEval = lastEvals.find((e: any) => e.decision === "PERLU_REVISI");

  const textField = (name: "topic" | "progress" | "challenges" | "nextSteps", label: string, multiline = true) => (
    <form.Field name={name}>
      {(f) => (
        <div>
          <Label className="text-xs sm:text-sm">{label}</Label>
          {multiline ? (
            <Textarea
              disabled={!editable}
              rows={3}
              className="mt-1"
              value={(f.state.value as string) ?? ""}
              onBlur={f.handleBlur}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          ) : (
            <Input
              disabled={!editable}
              className="mt-1"
              value={(f.state.value as string) ?? ""}
              onBlur={f.handleBlur}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
          <FieldError errors={f.state.meta.isTouched ? f.state.meta.errors : []} />
        </div>
      )}
    </form.Field>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight">{logbookId ? "Edit Logbook" : "Tambah Logbook Baru"}</h1>
        {existing && (
          <StatusBadge
            status={existing.status}
            label={
              existing.status === "MENUNGGU_VALIDASI" && existing.totalSupervisors > 1
                ? `Menunggu (${existing.approvedCount}/${existing.totalSupervisors} Pembimbing)`
                : LOGBOOK_STATUS_LABELS[existing.status as keyof typeof LOGBOOK_STATUS_LABELS]
            }
          />
        )}
      </div>

      {existing?.status === "PERLU_REVISI" && revisiEval && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3.5 sm:p-4 text-xs sm:text-sm">
          <div className="font-semibold text-rose-800">Catatan pembimbing ({revisiEval.lecturerName}) — perlu revisi</div>
          <p className="mt-1 text-rose-900 leading-relaxed">{revisiEval.comments}</p>
        </div>
      )}

      {existing?.status === "MENUNGGU_VALIDASI" && existing.totalSupervisors > 1 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 sm:p-4 text-xs sm:text-sm">
          <div className="font-semibold text-amber-900">
            Status Validasi: {existing.approvedCount} dari {existing.totalSupervisors} Dosen Pembimbing Menyetujui
          </div>
          <p className="mt-0.5 text-amber-800 leading-relaxed">
            Kedua dosen pembimbing harus memvalidasi bimbingan ini sebelum status logbook disetujui.
          </p>
        </div>
      )}

      {!editable && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs sm:text-sm text-muted-foreground">
          Logbook ini berstatus <span className="font-medium text-foreground">{LOGBOOK_STATUS_LABELS[existing.status as keyof typeof LOGBOOK_STATUS_LABELS]}</span> dan terkunci dari perubahan.
        </div>
      )}

      <Card className="shadow-xs">
        <CardContent className="p-4 sm:p-6">
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <form.Field name="sessionDate">
                {(f) => (
                  <div>
                    <Label className="text-xs sm:text-sm">Tanggal Bimbingan</Label>
                    <Input type="date" disabled={!editable} className="mt-1" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
                    <FieldError errors={f.state.meta.errors} />
                  </div>
                )}
              </form.Field>
              <form.Field name="lecturerId">
                {(f) => (
                  <div>
                    <Label className="text-xs sm:text-sm">Dosen Pembimbing Utama</Label>
                    <Select disabled={!editable} className="mt-1 text-xs sm:text-sm" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)}>
                      {supervisors.map((s) => (
                        <option key={s.lecturerId} value={s.lecturerId}>
                          {s.name} ({s.type.replace("_", " ")})
                        </option>
                      ))}
                    </Select>
                    <FieldError errors={f.state.meta.errors} />
                  </div>
                )}
              </form.Field>
            </div>

            {textField("topic", "Topik Bimbingan", false)}
            {textField("progress", "Progres / Hasil Pembahasan")}
            {textField("challenges", "Kendala yang Dihadapi")}
            {textField("nextSteps", "Rencana Tindak Lanjut")}

            {save.error && <p className="text-xs sm:text-sm text-destructive">{save.error.message}</p>}

            {editable && (
              <form.Subscribe selector={(s) => s.isSubmitting}>
                {(busy) => (
                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                    <Button type="button" variant="outline" className="w-full sm:w-auto h-9 text-xs sm:text-sm" disabled={busy} onClick={() => nav({ to: "/logbook" })}>
                      Batal
                    </Button>
                    <Button type="button" variant="secondary" className="w-full sm:w-auto h-9 text-xs sm:text-sm" disabled={busy} onClick={() => { submitRef.current = false; form.handleSubmit(); }}>
                      Simpan Draft
                    </Button>
                    <Button type="button" className="w-full sm:w-auto h-9 text-xs sm:text-sm" disabled={busy} onClick={() => { submitRef.current = true; form.handleSubmit(); }}>
                      {existing?.status === "PERLU_REVISI" ? "Ajukan Ulang" : "Ajukan Validasi"}
                    </Button>
                  </div>
                )}
              </form.Subscribe>
            )}
          </form>
        </CardContent>
      </Card>

      {existing?.versions?.length > 0 && (
        <Card className="shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-base sm:text-lg">Riwayat Versi & Validasi Pembimbing</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2">
            <ul className="divide-y divide-border text-xs sm:text-sm">
              {existing.versions.map((v: any) => (
                <li key={v.id} className="py-3">
                  <div className="font-semibold text-foreground">Versi {v.versionNo}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Diajukan pada {fmtDateTime(v.submittedAt)}</div>
                  {v.evaluations?.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {v.evaluations.map((ev: any) => (
                        <div key={ev.id} className="rounded-lg bg-muted/40 p-2.5 text-xs text-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div>
                            <span className="font-semibold text-foreground">{ev.lecturerName}: </span>
                            {ev.decision === "DISETUJUI" ? (
                              <span className="text-emerald-700 font-semibold">Disetujui (Skor: {ev.researchProgressScore}/5)</span>
                            ) : (
                              <span className="text-rose-700 font-semibold">Perlu Revisi</span>
                            )}
                            {ev.comments ? <span className="text-muted-foreground"> — &ldquo;{ev.comments}&rdquo;</span> : ""}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{fmtDateTime(ev.decidedAt)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1.5 text-xs text-amber-700 italic">
                      ⏳ Belum divalidasi oleh dosen pembimbing.
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
export type { LogbookInput };
