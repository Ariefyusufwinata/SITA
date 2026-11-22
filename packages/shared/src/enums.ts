export const ROLE_CODES = ["MAHASISWA","PEMBIMBING","PENGUJI","ADMIN_PRODI","KOORDINATOR","KEPALA_PRODI","ADMIN_TI"] as const;
export const SEMESTERS = ["GANJIL","GENAP"] as const;
export const THESIS_STAGES = ["PROPOSAL","PEMANTAUAN","SEMINAR","SIDANG_AKHIR","LULUS"] as const;
export const PROPOSAL_STAGES = ["PROPOSAL","PEMANTAUAN","SEMINAR"] as const;
export const THESIS_STATUSES = ["AKTIF","NONAKTIF","SELESAI"] as const;
export const SUPERVISOR_TYPES = ["PEMBIMBING_1","PEMBIMBING_2"] as const;
export const LOGBOOK_STATUSES = ["DRAFT","MENUNGGU_VALIDASI","DISETUJUI","PERLU_REVISI","DIBATALKAN"] as const;
export const DECISIONS = ["DISETUJUI","PERLU_REVISI"] as const;
export const ACTIVITY_CODES = ["SEMINAR_PROPOSAL","PEMANTAUAN","SIDANG_AKHIR"] as const;
export const REQUIREMENT_TYPES = ["WAJIB","OPSIONAL","TIDAK_BERLAKU"] as const;
export const APPLICATION_STATUSES = ["DRAFT","DIAJUKAN","DALAM_VERIFIKASI","PERLU_PERBAIKAN","MEMENUHI_SYARAT","MENUNGGU_PERSETUJUAN","DISETUJUI","DIJADWALKAN","TERLAKSANA","REVISI","DITUTUP","DITOLAK","DIBATALKAN"] as const;
export const SCAN_STATUSES = ["PENDING","CLEAN","INFECTED"] as const;
export const REVIEW_DECISIONS = ["MEMENUHI_SYARAT","PERLU_PERBAIKAN"] as const;
export const APPROVAL_DECISIONS = ["MENUNGGU","DISETUJUI","DITOLAK","PERLU_PERBAIKAN"] as const;
export const SCHEDULE_STATUSES = ["SEMENTARA","DIPUBLIKASIKAN","DIJADWALKAN_ULANG","DIBATALKAN"] as const;
export const EXAMINER_ROLES = ["KETUA_SIDANG","PENGUJI_1","PENGUJI_2"] as const;
export const SESSION_OUTCOMES = ["LULUS","LULUS_DENGAN_REVISI","TIDAK_LULUS"] as const;
export const REVISION_ITEM_STATUSES = ["TERBUKA","DIAJUKAN","DISETUJUI","DITOLAK"] as const;
export const REVISION_SUBMISSION_STATUSES = ["MENUNGGU","DISETUJUI","DITOLAK"] as const;
export const EMAIL_STATUSES = ["PENDING","SENT","FAILED"] as const;
export const TOPIC_STATUSES = ["TERSEDIA","PENUH","DITUTUP"] as const;

export const ROLE_LABELS: Record<(typeof ROLE_CODES)[number], string> = {
  MAHASISWA: "Mahasiswa", PEMBIMBING: "Dosen Pembimbing", PENGUJI: "Dosen Penguji",
  ADMIN_PRODI: "Admin Prodi", KOORDINATOR: "Koordinator Tesis", KEPALA_PRODI: "Kepala Program Studi", ADMIN_TI: "Admin TI",
};
export const TOPIC_STATUS_LABELS: Record<(typeof TOPIC_STATUSES)[number], string> = {
  TERSEDIA: "Tersedia", PENUH: "Penuh", DITUTUP: "Ditutup",
};
export const LOGBOOK_STATUS_LABELS: Record<(typeof LOGBOOK_STATUSES)[number], string> = {
  DRAFT: "Draft", MENUNGGU_VALIDASI: "Menunggu Validasi", DISETUJUI: "Disetujui",
  PERLU_REVISI: "Perlu Revisi", DIBATALKAN: "Dibatalkan",
};
export const THESIS_STAGE_LABELS: Record<(typeof THESIS_STAGES)[number], string> = {
  PROPOSAL: "Proposal", PEMANTAUAN: "Bimbingan", SEMINAR: "Seminar", SIDANG_AKHIR: "Sidang Akhir", LULUS: "Lulus",
};
export const SEMESTER_TARGET = 8;
