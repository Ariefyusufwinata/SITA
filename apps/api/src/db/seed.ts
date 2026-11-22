import { db, pool } from "./index";
import * as s from "./schema";
import { ROLE_CODES, ROLE_LABELS } from "@sita/shared";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Reset & seed data…");
  await db.execute(sql`TRUNCATE ${sql.join(
    [s.users, s.programs, s.roles, s.academicTerms, s.activityTypes].map((t) => sql`${t}`), sql`, `)} RESTART IDENTITY CASCADE`);

  const [program] = await db.insert(s.programs).values({ code: "MSF", name: "Magister Cybersecurity & Digital Forensics" }).returning();

  const [term] = await db.insert(s.academicTerms).values({
    year: 2026, semester: "GANJIL", active: true,
    startDate: new Date("2026-08-17T00:00:00+07:00"), endDate: new Date("2027-01-31T23:59:59+07:00"),
  }).returning();

  const roleRows = await db.insert(s.roles).values(ROLE_CODES.map((code) => ({ code, name: ROLE_LABELS[code] }))).returning();
  const roleId = (c: string) => roleRows.find((r) => r.code === c)!.id;

  const mk = async (name: string, username: string, email: string, passwordHash?: string) =>
    (await db.insert(s.users).values({ name, username, email, passwordHash }).returning())[0];
  const grant = (userId: string, codes: (typeof ROLE_CODES)[number][]) =>
    db.insert(s.userRoles).values(codes.map((c) => ({ userId, roleId: roleId(c), scopeId: program.id })));

  // Mahasiswa (Username murni huruf kecil tanpa titik/angka/karakter khusus)
  const uM1 = await mk("Andi Pratama", "andipratama", "andi.pratama@student.telkomuniversity.ac.id", "andipratama@2231001");
  const uM2 = await mk("Siti Nurhaliza", "sitinurhaliza", "siti.nurhaliza@student.telkomuniversity.ac.id", "sitinurhaliza@2231002");
  const [st1] = await db.insert(s.students).values({ userId: uM1.id, nim: "2231001", programId: program.id, cohortYear: 2023, phone: "081200000001" }).returning();
  const [st2] = await db.insert(s.students).values({ userId: uM2.id, nim: "2231002", programId: program.id, cohortYear: 2023, phone: "081200000002" }).returning();
  await grant(uM1.id, ["MAHASISWA"]); await grant(uM2.id, ["MAHASISWA"]);

  // Dosen (Username murni huruf kecil tanpa titik/angka/karakter khusus)
  const uD1 = await mk("Dr. Budi Santoso, M.T.", "budisantoso", "budi.santoso@telkomuniversity.ac.id", "budisantoso@19800101");
  const uD2 = await mk("Prof. Dewi Anggraini, Ph.D.", "dewianggraini", "dewi.anggraini@telkomuniversity.ac.id", "dewianggraini@19750505");
  const [lc1] = await db.insert(s.lecturers).values({ userId: uD1.id, nip: "19800101", nidn: "0401018001", programId: program.id, expertise: "Digital Forensics, Malware Analysis", isActiveSupervisor: true }).returning();
  const [lc2] = await db.insert(s.lecturers).values({ userId: uD2.id, nip: "19750505", nidn: "0405057501", programId: program.id, expertise: "Network Security, Cryptography", isActiveSupervisor: false }).returning();
  await grant(uD1.id, ["PEMBIMBING", "KOORDINATOR"]);
  await grant(uD2.id, ["PENGUJI"]);

  // Staf (Username murni huruf kecil tanpa titik/angka/karakter khusus)
  const uA1 = await mk("Rina Wulandari (Admin Prodi)", "rinawulandari", "admin.prodi@telkomuniversity.ac.id", "rinawulandari@adminprodi");
  const uA2 = await mk("Teguh Wibowo (Admin TI)", "teguhwibowo", "admin.ti@telkomuniversity.ac.id", "teguhwibowo@adminti");
  await grant(uA1.id, ["ADMIN_PRODI"]); await grant(uA2.id, ["ADMIN_TI"]);

  // Tesis & pembimbing
  const [t1] = await db.insert(s.thesisProjects).values({ studentId: st1.id, programId: program.id, termId: term.id, stage: "PEMANTAUAN", status: "AKTIF",
    title: "Deteksi Ransomware pada Lingkungan Cloud Menggunakan Analisis Perilaku Berbasis Machine Learning" }).returning();
  const [t2] = await db.insert(s.thesisProjects).values({ studentId: st2.id, programId: program.id, termId: term.id, stage: "PROPOSAL", status: "AKTIF",
    title: "Kerangka Akuisisi Bukti Digital pada Perangkat IoT Rumah Pintar" }).returning();
  const from = new Date("2026-08-17T00:00:00+07:00");
  await db.insert(s.supervisorAssignments).values([
    { thesisId: t1.id, lecturerId: lc1.id, supervisorType: "PEMBIMBING_1", effectiveFrom: from },
    { thesisId: t2.id, lecturerId: lc1.id, supervisorType: "PEMBIMBING_1", effectiveFrom: from },
  ]);

  await db.insert(s.academicPolicies).values({ programId: program.id, termId: term.id, version: 1, effectiveDate: from,
    rulesJson: { min_bimbingan: 8, jarak_hari_bimbingan: 7, syarat_tahap: { SEMINAR: { min_bimbingan_disetujui: 8 } } } });

  // Master kegiatan
  await db.insert(s.activityTypes).values([
    { code: "SEMINAR_PROPOSAL", name: "Seminar Proposal" }, { code: "PEMANTAUAN", name: "Pemantauan Kemajuan" }, { code: "SIDANG_AKHIR", name: "Sidang Akhir" },
  ]);

  // Katalog Topik Riset untuk Topic Shopping
  await db.insert(s.researchTopics).values([
    {
      programId: program.id,
      termId: term.id,
      lecturerId: lc1.id,
      title: "Deteksi Ransomware pada Lingkungan Cloud Menggunakan Analisis Perilaku Berbasis Machine Learning",
      description: "Riset berfokus pada ekstraksi artefak perilaku ransomware di lingkungan virtualized cloud computing dan klasifikasi payload menggunakan model ensemble learning.",
      focusArea: "Malware Analysis & Cloud Security",
      quota: 2,
      taken: 1,
      status: "TERSEDIA",
    },
    {
      programId: program.id,
      termId: term.id,
      lecturerId: lc1.id,
      title: "Analisis Forensik Memori pada Serangan Fileless Malware di Linux Server",
      description: "Investigasi teknik injeksi proses memori (/proc, ptrace) pada sistem operasi Linux tanpa meninggalkan jejak berkas biner di disk, menggunakan Volatility Framework 3.",
      focusArea: "Digital Forensics",
      quota: 2,
      taken: 0,
      status: "TERSEDIA",
    },
    {
      programId: program.id,
      termId: term.id,
      lecturerId: lc2.id,
      title: "Kerangka Keamanan Zero Trust Architecture pada Jaringan Kampus Pintar (Smart Campus)",
      description: "Desain dan evaluasi arsitektur keamanan Zero Trust (NIST SP 800-207) dengan micro-segmentation dan continuous verification pada infrastruktur hybrid kampus.",
      focusArea: "Network Security",
      quota: 2,
      taken: 0,
      status: "TERSEDIA",
    },
    {
      programId: program.id,
      termId: term.id,
      lecturerId: lc2.id,
      title: "Implementasi Algoritma Post-Quantum Cryptography (ML-KEM & ML-DSA) pada Protokol TLS 1.3",
      description: "Analisis overhead performa komputasi dan ketahanan kriptografis enkripsi pasca-kuantum terstandarisasi NIST pada kanal komunikasi terenkripsi performa tinggi.",
      focusArea: "Cryptography",
      quota: 1,
      taken: 0,
      status: "TERSEDIA",
    },
    {
      programId: program.id,
      termId: term.id,
      lecturerId: lc1.id,
      title: "Investigasi Forensik dan Mitigasi Insiden Kebocoran Kredensial API Berbasis MITRE ATT&CK",
      description: "Pemetaan taktik dan teknik peretasan API microservices cloud, serta pembangunan otomatisasi deteksi forensik berbasis honeypot dan audit log streaming.",
      focusArea: "Incident Response",
      quota: 2,
      taken: 0,
      status: "TERSEDIA",
    },
  ]);

  // Contoh logbook untuk Andi
  const now = Date.now(); const day = 86400000;
  const mkLb = async (i: number, status: (typeof s.logbooks.$inferInsert)["status"]) => {
    const [lb] = await db.insert(s.logbooks).values({
      thesisId: t1.id, lecturerId: lc1.id, termId: term.id, sessionDate: new Date(now - (10 - i) * 7 * day),
      topic: `Bimbingan ke-${i}: ${["Studi literatur", "Rumusan masalah", "Desain dataset", "Metodologi", "Prototipe awal"][i - 1] ?? "Pembahasan"}`,
      progress: "Menyelesaikan bagian sesuai arahan pembimbing.", challenges: "Keterbatasan data.", nextSteps: "Lanjut ke tahap berikutnya.",
      status, currentVersion: status === "DRAFT" ? 0 : 1,
    }).returning();
    if (status !== "DRAFT") {
      const [v] = await db.insert(s.logbookVersions).values({ logbookId: lb.id, versionNo: 1, payloadJson: { topic: lb.topic, progress: lb.progress } }).returning();
      if (status === "DISETUJUI" || status === "PERLU_REVISI")
        await db.insert(s.supervisorEvaluations).values({ logbookVersionId: v.id, lecturerId: lc1.id, researchProgressScore: 4, scheduleComplianceScore: 4, onTimeCompletionScore: 5,
          comments: status === "PERLU_REVISI" ? "Perjelas rumusan masalah." : "Baik.", decision: status });
    }
  };
  await mkLb(1, "DISETUJUI"); await mkLb(2, "DISETUJUI"); await mkLb(3, "DISETUJUI");
  await mkLb(4, "PERLU_REVISI"); await mkLb(5, "MENUNGGU_VALIDASI");

  console.log("Seed selesai.");
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
