import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, Compass, Plus, Trash2, Edit2, UserCheck, Search, BookOpen } from "lucide-react";
import { client, unwrap } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from "@/components/ui";
import { useMe } from "@/components/Layout";

type Topic = {
  id: string;
  title: string;
  description: string;
  focusArea: string;
  quota: number;
  taken: number;
  status: "TERSEDIA" | "PENUH" | "DITUTUP";
  lecturer: {
    id: string;
    name: string;
    nip: string;
    expertise: string | null;
  };
  term: string;
  program: string;
};

export function TopicsPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();

  const [search, setSearch] = useState("");
  const [selectedFocus, setSelectedFocus] = useState<string>("SEMUA");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "propose">("catalog");

  // Form State Topik Admin
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formFocus, setFormFocus] = useState("");
  const [formLecturerId, setFormLecturerId] = useState("");
  const [formQuota, setFormQuota] = useState(2);

  // Form State Pengajuan Topik Mandiri Mahasiswa
  const [propTitle, setPropTitle] = useState("");
  const [propDesc, setPropDesc] = useState("");
  const [propFocus, setPropFocus] = useState("Digital Forensics");
  const [propLecturerId, setPropLecturerId] = useState("");

  const isStudent = me?.role === "MAHASISWA";
  const canManage = me?.role === "ADMIN_PRODI" || me?.role === "KOORDINATOR" || me?.role === "PEMBIMBING" || me?.role === "KEPALA_PRODI";

  // Data Topik
  const { data: topics = [], isLoading } = useQuery({
    queryKey: ["topics"],
    queryFn: () => unwrap(client.api.topics.$get()),
  });

  // Data Dosen Pembimbing beserta Batas Kuota Bimbingan Dinamis dari Database
  const { data: supervisorsWithQuota = [] } = useQuery({
    queryKey: ["supervisors-quota"],
    queryFn: async () => {
      const res = await fetch("/api/topics/supervisors", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("sita_token")}`,
          ...(localStorage.getItem("sita_role_active") ? { "X-User-Role": localStorage.getItem("sita_role_active")! } : {}),
        },
      });
      return res.json();
    },
  });

  // Data Dosen Pembimbing untuk Admin saat menambah topik
  const { data: supervisors = [] } = useQuery({
    queryKey: ["supervisors-list"],
    enabled: canManage,
    queryFn: async () => {
      const res = await fetch("/api/auth/dev-users");
      const users = await res.json();
      return users
        .filter((u: any) => u.roles.some((r: any) => r.code === "PEMBIMBING" || r.code === "KOORDINATOR" || r.code === "KEPALA_PRODI"))
        .map((u: any) => ({
          userId: u.id,
          name: u.name,
          nip: u.nip,
        }));
    },
  });

  // Data Dosen Database UUID
  const { data: thesisSupervisors = [] } = useQuery({
    queryKey: ["thesis-supervisors"],
    enabled: canManage,
    queryFn: () => unwrap(client.api.logbooks.supervisors.$get()).catch(() => []),
  });

  // Profil tesis mahasiswa saat ini untuk menandai topik yang sedang diambil
  const { data: myThesis } = useQuery({
    queryKey: ["my-thesis"],
    enabled: isStudent,
    queryFn: () => unwrap(client.api.thesis.me.$get()).catch(() => null),
  });

  const hasActiveTopic = isStudent && !!myThesis?.title;

  // Mutasi: Pilih Topik (Mahasiswa)
  const selectMutation = useMutation({
    mutationFn: async (topicId: string) => {
      const res = await fetch(`/api/topics/${topicId}/select`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("sita_token")}`,
          ...(localStorage.getItem("sita_role") ? { "X-User-Role": localStorage.getItem("sita_role")! } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memilih topik");
      return data;
    },
    onSuccess: (data) => {
      alert(`Berhasil! ${data.message}`);
      qc.invalidateQueries();
      nav({ to: "/" });
    },
    onError: (err: Error) => {
      alert(`Peringatan: ${err.message}`);
    },
  });

  // Mutasi: Ajukan Topik Mandiri Mahasiswa ke Pembimbing
  const proposeMutation = useMutation({
    mutationFn: async (payload: { title: string; description: string; focusArea: string; lecturerId: string }) => {
      const res = await fetch("/api/topics/propose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("sita_token")}`,
          ...(localStorage.getItem("sita_role_active") ? { "X-User-Role": localStorage.getItem("sita_role_active")! } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengajukan topik mandiri");
      return data;
    },
    onSuccess: (data) => {
      alert(`Berhasil! ${data.message}`);
      qc.invalidateQueries();
      nav({ to: "/" });
    },
    onError: (err: Error) => {
      alert(`Gagal: ${err.message}`);
    },
  });

  // Mutasi: Simpan Topik (Admin/Dosen)
  const saveMutation = useMutation({
    mutationFn: async (topicData: any) => {
      const isEdit = !!editingTopic;
      const url = isEdit ? `/api/topics/${editingTopic.id}` : "/api/topics";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("sita_token")}`,
          ...(localStorage.getItem("sita_role") ? { "X-User-Role": localStorage.getItem("sita_role")! } : {}),
        },
        body: JSON.stringify(topicData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan topik");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topics"] });
      closeModal();
    },
    onError: (err: Error) => {
      alert(`Gagal: ${err.message}`);
    },
  });

  // Mutasi: Hapus Topik
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/topics/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("sita_token")}`,
          ...(localStorage.getItem("sita_role") ? { "X-User-Role": localStorage.getItem("sita_role")! } : {}),
        },
      });
      if (!res.ok) throw new Error("Gagal menghapus topik");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topics"] });
    },
  });

  const openCreateModal = () => {
    setEditingTopic(null);
    setFormTitle("");
    setFormDesc("");
    setFormFocus("Digital Forensics");
    setFormQuota(2);
    // Dosen ID default
    if (thesisSupervisors.length > 0) {
      setFormLecturerId(thesisSupervisors[0].lecturerId);
    }
    setModalOpen(true);
  };

  const openEditModal = (t: Topic) => {
    setEditingTopic(t);
    setFormTitle(t.title);
    setFormDesc(t.description);
    setFormFocus(t.focusArea);
    setFormQuota(t.quota);
    setFormLecturerId(t.lecturer.id);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTopic(null);
  };

  // Filter List
  const focusAreas = ["SEMUA", ...Array.from(new Set(topics.map((t) => t.focusArea)))];
  const filteredTopics = topics.filter((t) => {
    const matchSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.lecturer.name.toLowerCase().includes(search.toLowerCase());
    const matchFocus = selectedFocus === "SEMUA" || t.focusArea === selectedFocus;
    return matchSearch && matchFocus;
  });

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-6xl">
      {/* Header Halaman Responsif */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="text-primary h-6 w-6" />
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">
              {isStudent ? "Pilihan Topik Riset (Topic Shopping)" : "Katalog Topik Riset Tesis"}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {isStudent
              ? "Jelajahi dan pilih tema riset tesis beserta dosen pembimbing yang Anda minati di awal semester."
              : "Kelola daftar topik riset dan alokasi kuota bimbingan mahasiswa Magister Cybersecurity & Digital Forensics."}
          </p>
        </div>

        {canManage && (
          <Button onClick={openCreateModal} className="w-full sm:w-auto h-9 text-xs sm:text-sm gap-1.5">
            <Plus size={16} /> Tambah Topik Riset
          </Button>
        )}
      </div>

      {/* Tab Switcher Mahasiswa: Topic Shopping vs Pengajuan Mandiri */}
      {isStudent && (
        <div className="flex border-b border-border gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "catalog"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Katalog Topic Shopping
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("propose");
              if (!propLecturerId && supervisorsWithQuota.length > 0) {
                const firstAvailable = supervisorsWithQuota.find((s: any) => s.isAvailable);
                if (firstAvailable) setPropLecturerId(firstAvailable.id);
              }
            }}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "propose"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Ajukan Topik Mandiri ke Dosen Pembimbing
          </button>
        </div>
      )}

      {/* FORM PENGAJUAN TOPIK MANDIRI MAHASISWA */}
      {isStudent && activeTab === "propose" ? (
        <Card className="shadow-xs border-border">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-base sm:text-lg">Formulir Pengajuan Topik Mandiri</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Jika Anda tidak memilih topik dari katalog, Anda dapat mengusulkan tema riset mandiri dan memilih dosen pembimbing yang kuotanya masih tersedia.
            </p>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2">
            {hasActiveTopic ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs sm:text-sm text-foreground">
                <span className="font-bold text-primary block mb-1">Anda Sudah Memiliki Topik Tugas Akhir Aktif</span>
                Judul: <strong>"{myThesis?.title}"</strong>
                <p className="text-muted-foreground mt-1">
                  Mahasiswa yang telah memilih topik atau memiliki judul tesis aktif tidak dapat memilih atau mengajukan topik baru lagi.
                </p>
              </div>
            ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!propLecturerId) {
                  alert("Pilih dosen pembimbing tujuan");
                  return;
                }
                proposeMutation.mutate({
                  title: propTitle,
                  description: propDesc,
                  focusArea: propFocus,
                  lecturerId: propLecturerId,
                });
              }}
            >
              <div>
                <Label className="text-xs sm:text-sm">Judul Topik Riset yang Diajukan</Label>
                <Input
                  className="mt-1"
                  placeholder="mis. Analisis Keamanan Protokol Komunikasi IoT Menggunakan Kriptografi Ringan"
                  value={propTitle}
                  onChange={(e) => setPropTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs sm:text-sm">Bidang Fokus Riset</Label>
                  <Select
                    className="mt-1"
                    value={propFocus}
                    onChange={(e) => setPropFocus(e.target.value)}
                  >
                    <option value="Digital Forensics">Digital Forensics</option>
                    <option value="Malware Analysis">Malware Analysis</option>
                    <option value="Network Security">Network Security</option>
                    <option value="Cloud Security">Cloud Security</option>
                    <option value="Cryptography">Cryptography</option>
                    <option value="Incident Response">Incident Response</option>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs sm:text-sm">Pilih Dosen Pembimbing Tujuan (Batas Kuota Dinamis)</Label>
                  <Select
                    className="mt-1"
                    value={propLecturerId}
                    onChange={(e) => setPropLecturerId(e.target.value)}
                    required
                  >
                    <option value="" disabled>-- Pilih Dosen Pembimbing --</option>
                    {supervisorsWithQuota.map((lc: any) => (
                      <option
                        key={lc.id}
                        value={lc.id}
                        disabled={!lc.isAvailable}
                      >
                        {lc.name} ({lc.activeSupervisees}/{lc.quota} Bimbingan {!lc.isAvailable ? "— KUOTA PENUH" : "— Tersedia"})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs sm:text-sm">Deskripsi & Latar Belakang Riset</Label>
                <Textarea
                  rows={4}
                  className="mt-1"
                  placeholder="Jelaskan latar belakang masalah, urgensi riset, serta metode yang direncanakan…"
                  value={propDesc}
                  onChange={(e) => setPropDesc(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full sm:w-auto self-start mt-1"
                disabled={proposeMutation.isPending}
              >
                {proposeMutation.isPending ? "Mengajukan Topik…" : "Ajukan Topik ke Dosen Pembimbing"}
              </Button>
            </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bar Pencarian & Filter Bidang Fokus */}
          <Card className="shadow-xs p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul riset, kata kunci, atau nama dosen pembimbing..."
              className="pl-9 text-xs sm:text-sm h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs sm:text-sm shrink-0 text-muted-foreground hidden sm:inline">Bidang:</Label>
            <Select
              value={selectedFocus}
              onChange={(e) => setSelectedFocus(e.target.value)}
              className="w-full sm:w-52 text-xs sm:text-sm h-9"
            >
              {focusAreas.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Status Mahasiswa saat ini */}
      {isStudent && myThesis && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 sm:p-4 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-primary flex items-center gap-1.5">
              <BookOpen size={16} /> Topik & Dosen Pembimbing Anda Saat Ini:
            </div>
            <p className="text-foreground font-medium mt-1">{myThesis.title}</p>
            <div className="text-muted-foreground text-xs mt-0.5">
              Pembimbing: {myThesis.supervisors?.[0]?.name ?? "Belum ditentukan"} ({myThesis.stage})
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => nav({ to: "/" })} className="text-xs h-8 whitespace-nowrap self-start sm:self-auto">
            Lihat di Dashboard
          </Button>
        </div>
      )}

      {/* Grid Katalog Topik */}
      {isLoading ? (
        <p className="text-xs sm:text-sm text-muted-foreground p-4">Memuat katalog topik…</p>
      ) : filteredTopics.length === 0 ? (
        <Card className="p-8 text-center text-xs sm:text-sm text-muted-foreground">
          Tidak ada topik riset yang cocok dengan kriteria pencarian Anda.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredTopics.map((topic) => {
            const isFull = topic.taken >= topic.quota;
            const remainingQuota = Math.max(0, topic.quota - topic.taken);
            const isCurrentTopic = isStudent && myThesis?.title === topic.title;

            return (
              <Card key={topic.id} className="flex flex-col justify-between shadow-xs border-border hover:border-primary/40 transition-all">
                <CardHeader className="p-4 sm:p-5 pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-primary/10 text-primary">
                      {topic.focusArea}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        isFull
                          ? "bg-rose-100 text-rose-800"
                          : topic.taken > 0
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {isFull ? "Kuota Penuh" : `Sisa Kuota: ${remainingQuota} dari ${topic.quota}`}
                    </span>
                  </div>
                  <CardTitle className="text-base sm:text-lg font-bold text-foreground leading-snug">
                    {topic.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 pt-2 flex flex-col gap-3.5 flex-1 justify-between">
                  {/* Deskripsi Topik */}
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {topic.description}
                  </p>

                  {/* Profil Dosen Pembimbing */}
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <UserCheck size={14} className="text-primary" /> {topic.lecturer.name}
                    </div>
                    <div className="text-muted-foreground mt-0.5">NIP: {topic.lecturer.nip}</div>
                    {topic.lecturer.expertise && (
                      <div className="text-muted-foreground italic mt-0.5 truncate">
                        Keahlian: {topic.lecturer.expertise}
                      </div>
                    )}
                  </div>

                  {/* Tombol Aksi */}
                  <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">{topic.term}</span>

                    {/* Aksi Mahasiswa */}
                    {isStudent && (
                      <div>
                        {isCurrentTopic ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                            <Check size={14} /> Topik Aktif Anda
                          </span>
                        ) : hasActiveTopic ? null : (
                          <Button
                            size="sm"
                            disabled={isFull || selectMutation.isPending}
                            onClick={() => {
                              if (confirm(`Pilih topik "${topic.title}" dan tetapkan ${topic.lecturer.name} sebagai Pembimbing 1?`)) {
                                selectMutation.mutate(topic.id);
                              }
                            }}
                            className="text-xs h-8 px-3"
                          >
                            {isFull ? "Penuh" : "Pilih Topik Ini"}
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Aksi Admin / Dosen */}
                    {canManage && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 px-2.5"
                          onClick={() => openEditModal(topic)}
                        >
                          <Edit2 size={13} className="mr-1" /> Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="text-xs h-8 px-2.5"
                          onClick={() => {
                            if (confirm(`Hapus topik "${topic.title}"?`)) {
                              deleteMutation.mutate(topic.id);
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Modal Tambah / Edit Topik */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-xl border border-border bg-white p-5 sm:p-6 shadow-2xl">
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              {editingTopic ? "Edit Topik Riset" : "Tambah Topik Riset Baru"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lengkapi informasi topik riset yang ditawarkan untuk mahasiswa.
            </p>

            <form
              className="mt-4 flex flex-col gap-3.5"
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate({
                  title: formTitle,
                  description: formDesc,
                  focusArea: formFocus,
                  lecturerId: formLecturerId,
                  quota: formQuota,
                  status: "TERSEDIA",
                });
              }}
            >
              <div>
                <Label className="text-xs sm:text-sm">Judul Topik Riset</Label>
                <Input
                  className="mt-1 text-xs sm:text-sm"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="mis. Analisis Serangan Ransomware pada Smart Grid..."
                  required
                />
              </div>

              <div>
                <Label className="text-xs sm:text-sm">Dosen Pembimbing</Label>
                <Select
                  className="mt-1 text-xs sm:text-sm"
                  value={formLecturerId}
                  onChange={(e) => setFormLecturerId(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Dosen Pembimbing --</option>
                  {thesisSupervisors.map((s: any) => (
                    <option key={s.lecturerId} value={s.lecturerId}>
                      {s.name} ({s.type.replace("_", " ")})
                    </option>
                  ))}
                  {/* Fallback jika thesisSupervisors kosong */}
                  {thesisSupervisors.length === 0 &&
                    supervisors.map((s: any) => (
                      <option key={s.userId} value={s.userId}>
                        {s.name} (NIP: {s.nip})
                      </option>
                    ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs sm:text-sm">Bidang Fokus</Label>
                  <Input
                    className="mt-1 text-xs sm:text-sm"
                    value={formFocus}
                    onChange={(e) => setFormFocus(e.target.value)}
                    placeholder="mis. Digital Forensics"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Kuota Mahasiswa</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className="mt-1 text-xs sm:text-sm"
                    value={formQuota}
                    onChange={(e) => setFormQuota(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs sm:text-sm">Deskripsi & Ruang Lingkup Riset</Label>
                <Textarea
                  rows={4}
                  className="mt-1 text-xs sm:text-sm"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Uraikan latar belakang masalah, metodologi yang diharapkan, dan deliverables..."
                  required
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={closeModal} disabled={saveMutation.isPending}>
                  Batal
                </Button>
                <Button type="submit" size="sm" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Menyimpan…" : "Simpan Topik"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
