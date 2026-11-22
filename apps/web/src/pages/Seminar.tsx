import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { CheckCircle2, Clock, ExternalLink, FileText, Info, ShieldCheck, UserCheck, XCircle } from "lucide-react";
import { auth, client, unwrap } from "@/lib/api";
import { fmtDateTime } from "@/lib/utils";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from "@/components/ui";

const SCORES = [1, 2, 3, 4, 5];

export function SeminarPage() {
  const qc = useQueryClient();
  const isStudent = auth.role === "MAHASISWA";
  const [selectedSeminarId, setSelectedSeminarId] = useState<string | null>(null);

  // Data untuk mahasiswa
  const eligibility = useQuery({
    queryKey: ["seminar-eligibility"],
    queryFn: () => unwrap(client.api.seminars.eligibility.$get()),
    enabled: isStudent,
  });

  const mySeminar = useQuery({
    queryKey: ["my-seminar"],
    queryFn: () => unwrap(client.api.seminars.my.$get()),
    enabled: isStudent,
  });

  // Data untuk dosen penguji / staf
  const allSeminars = useQuery({
    queryKey: ["all-seminars"],
    queryFn: () => unwrap(client.api.seminars.$get()),
    enabled: !isStudent,
  });

  // Mutation Mahasiswa Submit Seminar
  const submitSeminar = useMutation({
    mutationFn: async (val: { proposalDocumentUrl: string; presentationNotes: string }) => {
      return unwrap(client.api.seminars.$post({ json: val }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-seminar"] });
      qc.invalidateQueries({ queryKey: ["seminar-eligibility"] });
      qc.invalidateQueries({ queryKey: ["thesis-me"] });
    },
  });

  // Mutation Dosen Penguji Evaluasi Seminar
  const evaluateSeminar = useMutation({
    mutationFn: async (val: {
      seminarId: string;
      theoryMasteryScore: number;
      methodologyScore: number;
      writingQualityScore: number;
      comments: string;
      decision: "LULUS" | "LULUS_DENGAN_REVISI" | "TIDAK_LULUS";
    }) => {
      return unwrap(client.api.seminars.evaluate.$post({ json: val }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-seminars"] });
      setSelectedSeminarId(null);
    },
  });

  // Form Pengajuan Seminar (Mahasiswa)
  const submissionForm = useForm({
    defaultValues: {
      proposalDocumentUrl: "",
      presentationNotes: "",
    },
    onSubmit: async ({ value }) => {
      await submitSeminar.mutateAsync(value);
    },
  });

  // Form Penilaian (Dosen Penguji)
  const evaluationForm = useForm({
    defaultValues: {
      theoryMasteryScore: 4,
      methodologyScore: 4,
      writingQualityScore: 4,
      comments: "",
      decision: "LULUS" as "LULUS" | "LULUS_DENGAN_REVISI" | "TIDAK_LULUS",
    },
    onSubmit: async ({ value }) => {
      if (!selectedSeminarId) return;
      await evaluateSeminar.mutateAsync({
        seminarId: selectedSeminarId,
        ...value,
      });
    },
  });

  const selectedSeminar = allSeminars.data?.find((s: any) => s.id === selectedSeminarId);

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Header Halaman */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
            Seminar Proposal
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">Seminar Proposal Thesis</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          {isStudent
            ? "Pendaftaran seminar proposal thesis setelah menyelesaikan minimal 4x bimbingan logbook yang disetujui."
            : "Penilaian seminar proposal thesis mahasiswa oleh 2 orang dosen penguji."}
        </p>
      </div>

      {/* TAMPILAN MAHASISWA */}
      {isStudent && (
        <div className="flex flex-col gap-5">
          {/* Tracker Persyaratan Bimbingan */}
          <Card className="shadow-xs border-border">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                <span>Persyaratan Menuju Seminar</span>
                {eligibility.data?.eligible ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                    <CheckCircle2 size={14} /> Memenuhi Syarat (≥ 4 Bimbingan)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                    <Clock size={14} /> Belum Memenuhi Syarat (&lt; 4 Bimbingan)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3.5 bg-muted/20">
                  <div className="text-xs text-muted-foreground">Progres Bimbingan Disetujui</div>
                  <div className="text-lg font-bold text-foreground mt-1 flex items-baseline gap-1.5">
                    <span className={eligibility.data?.eligible ? "text-emerald-700 font-extrabold" : "text-amber-700 font-extrabold"}>
                      {eligibility.data?.approvedCount ?? 0}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">/ minimal 4 bimbingan</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {eligibility.data?.eligible
                      ? "Selamat! Anda telah menyelesaikan minimal 4x bimbingan yang divalidasi oleh seluruh dosen pembimbing."
                      : `Anda baru memiliki ${eligibility.data?.approvedCount ?? 0} bimbingan yang disetujui. Silakan lengkapi bimbingan sebelum mendaftar seminar.`}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3.5 bg-muted/20">
                  <div className="text-xs text-muted-foreground">Status Proposal Thesis</div>
                  <div className="text-sm font-semibold text-foreground mt-1">
                    {eligibility.data?.thesis?.title ?? "Judul Tesis Belum Terdaftar"}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                      Tahap: {eligibility.data?.thesis?.stage ?? "PROPOSAL"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Jika Mahasiswa Sudah Mengajukan Seminar */}
          {mySeminar.data ? (
            <Card className="shadow-xs border-border">
              <CardHeader className="p-4 sm:p-5 pb-2">
                <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                  <span>Status Pengajuan Seminar Anda</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    mySeminar.data.status === "SELESAI" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                  }`}>
                    {mySeminar.data.status === "SELESAI"
                      ? `Selesai (${mySeminar.data.outcome ?? "LULUS"})`
                      : "Menunggu Penilaian 2 Dosen Penguji"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-2 flex flex-col gap-4">
                <div className="rounded-lg border border-border p-3.5 bg-muted/10 space-y-2">
                  <div>
                    <span className="text-xs text-muted-foreground block">Tautan Dokumen Proposal Thesis:</span>
                    <a
                      href={mySeminar.data.proposalDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs sm:text-sm font-semibold text-primary hover:underline flex items-center gap-1.5 mt-0.5 break-all"
                    >
                      <ExternalLink size={14} className="shrink-0" /> {mySeminar.data.proposalDocumentUrl}
                    </a>
                  </div>
                  {mySeminar.data.presentationNotes && (
                    <div className="pt-2 border-t border-border/70">
                      <span className="text-xs text-muted-foreground block">Catatan Tambahan:</span>
                      <p className="text-xs text-foreground mt-0.5">{mySeminar.data.presentationNotes}</p>
                    </div>
                  )}
                </div>

                {/* Status Penilaian dari 2 Penguji */}
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <UserCheck size={16} className="text-primary" /> Penilaian Dosen Penguji ({mySeminar.data.evaluations?.length ?? 0}/2 Penguji)
                  </h3>

                  {(!mySeminar.data.evaluations || mySeminar.data.evaluations.length === 0) ? (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      Dokumen proposal telah diajukan. Menunggu proses penilaian dari 2 orang dosen penguji.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {mySeminar.data.evaluations.map((ev: any, idx: number) => (
                        <div key={ev.id} className="rounded-lg border border-border p-3.5 bg-white shadow-2xs">
                          <div className="flex items-center justify-between pb-2 border-b border-border/70">
                            <div>
                              <div className="text-xs font-bold text-foreground">{ev.lecturer?.user?.name ?? `Dosen Penguji ${idx + 1}`}</div>
                              <div className="text-[10px] text-muted-foreground">{ev.examinerRole}</div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              ev.decision === "LULUS" ? "bg-emerald-100 text-emerald-800" :
                              ev.decision === "LULUS_DENGAN_REVISI" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                            }`}>
                              {ev.decision}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 py-2 text-center text-xs border-b border-border/70">
                            <div className="p-1 rounded bg-muted/30">
                              <div className="text-[10px] text-muted-foreground">Teori</div>
                              <div className="font-bold text-foreground">{ev.theoryMasteryScore} / 5</div>
                            </div>
                            <div className="p-1 rounded bg-muted/30">
                              <div className="text-[10px] text-muted-foreground">Metodologi</div>
                              <div className="font-bold text-foreground">{ev.methodologyScore} / 5</div>
                            </div>
                            <div className="p-1 rounded bg-muted/30">
                              <div className="text-[10px] text-muted-foreground">Penulisan</div>
                              <div className="font-bold text-foreground">{ev.writingQualityScore} / 5</div>
                            </div>
                          </div>

                          {ev.comments && (
                            <div className="pt-2 text-xs">
                              <span className="text-[11px] text-muted-foreground font-semibold">Catatan Penguji:</span>
                              <p className="text-xs text-foreground mt-0.5 italic">"{ev.comments}"</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Form Pengajuan Seminar jika Belum Mengajukan */
            <Card className="shadow-xs border-border">
              <CardHeader className="p-4 sm:p-5 pb-2">
                <CardTitle className="text-base sm:text-lg">Formulir Pendaftaran Seminar Proposal</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-2">
                {!eligibility.data?.eligible ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start gap-3">
                    <Info size={18} className="shrink-0 text-amber-700 mt-0.5" />
                    <div>
                      <span className="font-bold block">Pendaftaran Seminar Belum Dibuka untuk Akun Anda</span>
                      Anda harus memiliki minimal 4x bimbingan logbook yang telah disetujui oleh seluruh dosen pembimbing sebelum dapat mengumpulkan dokumen proposal thesis.
                    </div>
                  </div>
                ) : (
                  <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submissionForm.handleSubmit();
                    }}
                  >
                    <submissionForm.Field name="proposalDocumentUrl">
                      {(f) => (
                        <div>
                          <Label className="text-xs sm:text-sm">Tautan Dokumen Proposal Thesis (URL / Link Cloud)</Label>
                          <p className="text-[11px] text-muted-foreground mb-1">
                            Masukkan link Google Docs, Google Drive, atau tautan dokumen proposal thesis lengkap Anda.
                          </p>
                          <Input
                            placeholder="mis. https://drive.google.com/file/d/proposal-thesis-andi/view"
                            value={f.state.value}
                            onChange={(e) => f.handleChange(e.target.value)}
                            required
                          />
                        </div>
                      )}
                    </submissionForm.Field>

                    <submissionForm.Field name="presentationNotes">
                      {(f) => (
                        <div>
                          <Label className="text-xs sm:text-sm">Catatan / Deskripsi Singkat Presentasi (Opsional)</Label>
                          <Textarea
                            rows={3}
                            placeholder="Tuliskan poin-poin fokus atau catatan pengantar untuk dosen penguji…"
                            value={f.state.value}
                            onChange={(e) => f.handleChange(e.target.value)}
                          />
                        </div>
                      )}
                    </submissionForm.Field>

                    <Button
                      type="submit"
                      className="w-full sm:w-auto self-start mt-2"
                      disabled={submitSeminar.isPending}
                    >
                      {submitSeminar.isPending ? "Mengirim Pendaftaran…" : "Ajukan Dokumen & Daftar Seminar"}
                    </Button>

                    {submitSeminar.error && (
                      <p className="text-xs text-destructive">{submitSeminar.error.message}</p>
                    )}
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAMPILAN DOSEN PENGUJI / KOORDINATOR / KEPALA PRODI */}
      {!isStudent && (
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          {/* Daftar Pengajuan Seminar */}
          <Card className="shadow-xs border-border h-fit">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                <span>Daftar Pengajuan Seminar</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {allSeminars.data?.length ?? 0}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-2">
              {allSeminars.isLoading && <p className="text-xs text-muted-foreground">Memuat daftar seminar…</p>}
              {!allSeminars.isLoading && (allSeminars.data?.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground py-3">Belum ada pengajuan seminar dari mahasiswa.</p>
              )}

              <div className="flex flex-col gap-2.5">
                {allSeminars.data?.map((sem: any) => (
                  <button
                    key={sem.id}
                    type="button"
                    onClick={() => setSelectedSeminarId(sem.id)}
                    className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-all ${
                      sem.id === selectedSeminarId
                        ? "border-primary bg-primary/5 shadow-2xs"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="text-xs font-bold text-foreground line-clamp-1">{sem.thesisTitle}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {sem.studentName} ({sem.nim})
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className={`px-2 py-0.5 rounded font-semibold ${
                        sem.evaluationsCount >= 2 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {sem.evaluationsCount}/2 Penguji Dinilai
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">{fmtDateTime(sem.createdAt).slice(0, 11)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Panel Detail & Formulir Penilaian Dosen Penguji */}
          <div>
            {!selectedSeminar ? (
              <Card className="shadow-xs border-dashed border-border p-8 text-center text-muted-foreground">
                <FileText size={32} className="mx-auto mb-2 opacity-40 text-primary" />
                <p className="text-sm font-semibold">Pilih mahasiswa dari daftar sebelah kiri</p>
                <p className="text-xs mt-1">Klik pada salah satu pengajuan seminar untuk melihat dokumen proposal dan melakukan penilaian 2 orang penguji.</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Info Dokumen Proposal Mahasiswa */}
                <Card className="shadow-xs border-border">
                  <CardHeader className="p-4 sm:p-5 pb-2">
                    <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                      <span>Dokumen Proposal Thesis</span>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
                        selectedSeminar.evaluationsCount >= 2 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {selectedSeminar.evaluationsCount >= 2 ? "Selesai Dinilai (2/2)" : `Menunggu Penilaian (${selectedSeminar.evaluationsCount}/2 Penguji)`}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 pt-2 flex flex-col gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Mahasiswa:</div>
                      <div className="text-sm font-bold text-foreground">{selectedSeminar.studentName} ({selectedSeminar.nim})</div>
                      <div className="text-xs font-medium text-foreground mt-1">"{selectedSeminar.thesisTitle}"</div>
                    </div>

                    <div className="rounded-lg border border-border p-3 bg-muted/20">
                      <span className="text-xs text-muted-foreground block font-medium">Tautan Dokumen Proposal:</span>
                      <a
                        href={selectedSeminar.proposalDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs sm:text-sm font-bold text-primary hover:underline flex items-center gap-1.5 mt-1 break-all"
                      >
                        <ExternalLink size={15} className="shrink-0" /> {selectedSeminar.proposalDocumentUrl}
                      </a>
                    </div>

                    {/* Riwayat Penilaian Penguji Sebelumnya */}
                    {selectedSeminar.evaluations?.length > 0 && (
                      <div className="pt-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                          Penilaian Masuk ({selectedSeminar.evaluations.length}/2):
                        </span>
                        <div className="space-y-2">
                          {selectedSeminar.evaluations.map((ev: any) => (
                            <div key={ev.id} className="rounded-lg border border-border p-3 bg-white text-xs">
                              <div className="flex items-center justify-between font-bold">
                                <span>{ev.examinerName} ({ev.examinerRole})</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] ${
                                  ev.decision === "LULUS" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                }`}>
                                  {ev.decision}
                                </span>
                              </div>
                              <div className="mt-1.5 text-muted-foreground">
                                Skor Teori: <strong className="text-foreground">{ev.theoryMasteryScore}</strong> ·
                                Metodologi: <strong className="text-foreground">{ev.methodologyScore}</strong> ·
                                Penulisan: <strong className="text-foreground">{ev.writingQualityScore}</strong> (Rata-rata: {ev.averageScore})
                              </div>
                              {ev.comments && <p className="mt-1 text-foreground italic">"{ev.comments}"</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Form Input Penilaian Dosen Penguji */}
                <Card className="shadow-xs border-border">
                  <CardHeader className="p-4 sm:p-5 pb-2">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <ShieldCheck size={18} className="text-primary" /> Formulir Penilaian Dosen Penguji
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 pt-2">
                    <form
                      className="flex flex-col gap-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        evaluationForm.handleSubmit();
                      }}
                    >
                      <div className="grid gap-3 sm:grid-cols-3">
                        <evaluationForm.Field name="theoryMasteryScore">
                          {(f) => (
                            <div>
                              <Label className="text-xs font-semibold">Penguasaan Teori & Konsep (1 - 5)</Label>
                              <Select
                                className="mt-1"
                                value={String(f.state.value)}
                                onChange={(e) => f.handleChange(Number(e.target.value))}
                              >
                                {SCORES.map((s) => (
                                  <option key={s} value={s}>
                                    {s} — {s === 5 ? "Sangat Baik" : s === 4 ? "Baik" : s === 3 ? "Cukup" : s === 2 ? "Kurang" : "Sangat Kurang"}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )}
                        </evaluationForm.Field>

                        <evaluationForm.Field name="methodologyScore">
                          {(f) => (
                            <div>
                              <Label className="text-xs font-semibold">Metodologi Riset (1 - 5)</Label>
                              <Select
                                className="mt-1"
                                value={String(f.state.value)}
                                onChange={(e) => f.handleChange(Number(e.target.value))}
                              >
                                {SCORES.map((s) => (
                                  <option key={s} value={s}>
                                    {s} — {s === 5 ? "Sangat Baik" : s === 4 ? "Baik" : s === 3 ? "Cukup" : s === 2 ? "Kurang" : "Sangat Kurang"}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )}
                        </evaluationForm.Field>

                        <evaluationForm.Field name="writingQualityScore">
                          {(f) => (
                            <div>
                              <Label className="text-xs font-semibold">Kualitas Penulisan (1 - 5)</Label>
                              <Select
                                className="mt-1"
                                value={String(f.state.value)}
                                onChange={(e) => f.handleChange(Number(e.target.value))}
                              >
                                {SCORES.map((s) => (
                                  <option key={s} value={s}>
                                    {s} — {s === 5 ? "Sangat Baik" : s === 4 ? "Baik" : s === 3 ? "Cukup" : s === 2 ? "Kurang" : "Sangat Kurang"}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )}
                        </evaluationForm.Field>
                      </div>

                      <evaluationForm.Field name="decision">
                        {(f) => (
                          <div>
                            <Label className="text-xs font-semibold">Keputusan Akhir Penguji</Label>
                            <Select
                              className="mt-1"
                              value={f.state.value}
                              onChange={(e) => f.handleChange(e.target.value as any)}
                            >
                              <option value="LULUS">Lulus</option>
                              <option value="LULUS_DENGAN_REVISI">Lulus dengan Catatan Revisi</option>
                              <option value="TIDAK_LULUS">Tidak Lulus (Perlu Mengulang)</option>
                            </Select>
                          </div>
                        )}
                      </evaluationForm.Field>

                      <evaluationForm.Field name="comments">
                        {(f) => (
                          <div>
                            <Label className="text-xs font-semibold">Catatan & Masukan Penguji</Label>
                            <Textarea
                              rows={3}
                              className="mt-1"
                              placeholder="Tuliskan catatan perbaikan dan feedback penguji…"
                              value={f.state.value}
                              onChange={(e) => f.handleChange(e.target.value)}
                            />
                          </div>
                        )}
                      </evaluationForm.Field>

                      <Button
                        type="submit"
                        className="w-full sm:w-auto self-start"
                        disabled={evaluateSeminar.isPending}
                      >
                        {evaluateSeminar.isPending ? "Menyimpan Penilaian…" : "Simpan Penilaian Penguji"}
                      </Button>

                      {evaluateSeminar.error && (
                        <p className="text-xs text-destructive">{evaluateSeminar.error.message}</p>
                      )}
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
