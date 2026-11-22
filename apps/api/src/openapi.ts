export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "SITA (Sistem Integrasi Tracking Akademik) API",
    version: "1.0.0",
    description: `API Documentation untuk Sistem Integrasi Tracking Akademik (SITA).
    
Fitur Keamanan & Lab Testing:
- Autentikasi menggunakan **Bearer JWT Token** pada header \`Authorization: Bearer <token>\`.
- Dukungan Role Switcher & Privilege Escalation testing via header \`X-User-Role\` (misal: \`MAHASISWA\`, \`PEMBIMBING\`, \`KOORDINATOR\`, \`PENGUJI\`, \`ADMIN_PRODI\`, \`KEPALA_PRODI\`).
- Multi-dosen pembimbing validation untuk logbook bimbingan tugas akhir.`,
  },
  servers: [
    {
      url: "/api",
      description: "SITA API Gateway",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Masukkan JWT Token dari endpoint /auth/login atau /auth/dev-login.",
      },
      RoleHeader: {
        type: "apiKey",
        in: "header",
        name: "X-User-Role",
        description: "Role aktif yang disimulasikan oleh client (MAHASISWA, PEMBIMBING, KOORDINATOR, PENGUJI, ADMIN_PRODI, KEPALA_PRODI).",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
      DevLoginInput: {
        type: "object",
        required: ["role"],
        properties: {
          identifier: { type: "string", description: "Email, NIM, atau NIP" },
          userId: { type: "string", format: "uuid" },
          role: {
            type: "string",
            enum: ["MAHASISWA", "PEMBIMBING", "KOORDINATOR", "PENGUJI", "ADMIN_PRODI", "KEPALA_PRODI"],
          },
        },
      },
      LoginInput: {
        type: "object",
        required: ["username", "password"],
        properties: {
          username: { type: "string", example: "andi" },
          password: { type: "string", example: "password123" },
          role: {
            type: "string",
            enum: ["MAHASISWA", "PEMBIMBING", "KOORDINATOR", "PENGUJI", "ADMIN_PRODI", "KEPALA_PRODI"],
          },
        },
      },
      SwitchRoleInput: {
        type: "object",
        required: ["role"],
        properties: {
          role: {
            type: "string",
            enum: ["MAHASISWA", "PEMBIMBING", "KOORDINATOR", "PENGUJI", "ADMIN_PRODI", "KEPALA_PRODI"],
          },
        },
      },
      LogbookInput: {
        type: "object",
        required: ["lecturerId", "sessionDate", "topic", "progress"],
        properties: {
          lecturerId: { type: "string", format: "uuid" },
          sessionDate: { type: "string", format: "date", example: "2026-11-22" },
          topic: { type: "string", example: "Perancangan Arsitektur Microservices" },
          progress: { type: "string", example: "Menyelesaikan diagram konteks dan ERD" },
          challenges: { type: "string", example: "Optimasi relasi database" },
          nextSteps: { type: "string", example: "Implementasi endpoint validasi" },
          submit: { type: "boolean", default: false, description: "True jika langsung diajukan ke pembimbing, false jika disimpan sebagai draft" },
        },
      },
      EvaluationInput: {
        type: "object",
        required: ["logbookId", "researchProgressScore", "scheduleComplianceScore", "onTimeCompletionScore", "decision"],
        properties: {
          logbookId: { type: "string", format: "uuid" },
          researchProgressScore: { type: "integer", minimum: 1, maximum: 5 },
          scheduleComplianceScore: { type: "integer", minimum: 1, maximum: 5 },
          onTimeCompletionScore: { type: "integer", minimum: 1, maximum: 5 },
          comments: { type: "string" },
          decision: {
            type: "string",
            enum: ["DISETUJUI", "PERLU_REVISI", "DITOLAK"],
          },
        },
      },
      TopicInput: {
        type: "object",
        required: ["title", "description", "focusArea", "lecturerId"],
        properties: {
          title: { type: "string", example: "Analisis Kerentanan Web App" },
          description: { type: "string", example: "Penelitian kerentanan IDOR dan Broken Object Level Authorization" },
          focusArea: { type: "string", example: "Keamanan Siber" },
          lecturerId: { type: "string", format: "uuid" },
          quota: { type: "integer", minimum: 1, maximum: 10, default: 1 },
          status: { type: "string", enum: ["TERSEDIA", "PENUH", "DITUTUP"], default: "TERSEDIA" },
        },
      },
    },
  },
  security: [
    {
      BearerAuth: [],
      RoleHeader: [],
    },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Cek status server dan koneksi",
        security: [],
        responses: {
          200: {
            description: "Server berjalan normal",
            content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } } } } },
          },
        },
      },
    },
    "/auth/dev-users": {
      get: {
        tags: ["Authentication"],
        summary: "Daftar akun dev untuk Quick Role Switcher",
        security: [],
        responses: {
          200: {
            description: "Daftar pengguna dengan roles dan credentials demo",
          },
        },
      },
    },
    "/auth/dev-login": {
      post: {
        tags: ["Authentication"],
        summary: "Login instan akun dev tanpa verifikasi password",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/DevLoginInput" } } },
        },
        responses: {
          200: { description: "Login berhasil, mengembalikan token JWT dan profil peran" },
          403: { description: "Akun tidak memiliki peran yang diminta" },
          404: { description: "Akun tidak ditemukan" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Login dengan username / email / NIM / NIP dan password",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginInput" } } },
        },
        responses: {
          200: { description: "Login berhasil" },
          401: { description: "Password salah" },
          404: { description: "Username/NIM/NIP tidak ditemukan" },
        },
      },
    },
    "/auth/switch-role": {
      post: {
        tags: ["Authentication"],
        summary: "Ganti peran aktif pengguna yang sedang login",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SwitchRoleInput" } } },
        },
        responses: {
          200: { description: "Peran berhasil diganti, token baru diterbitkan" },
          400: { description: "Peran tidak valid" },
        },
      },
    },
    "/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Statistik dashboard sesuai peran aktif pengguna",
        responses: {
          200: { description: "Metrik progres, kuota, target semester, dan daftar tugas tertunda" },
        },
      },
    },
    "/thesis/me": {
      get: {
        tags: ["Thesis"],
        summary: "Profil tugas akhir / tesis milik mahasiswa yang sedang login",
        responses: {
          200: { description: "Detail tesis mahasiswa aktif beserta daftar dosen pembimbing" },
          404: { description: "Profil tesis tidak ditemukan" },
        },
      },
    },
    "/thesis/student/{nim}": {
      get: {
        tags: ["Thesis"],
        summary: "Ambil profil tesis mahasiswa berdasarkan NIM",
        parameters: [
          { name: "nim", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Profil tesis mahasiswa" },
          404: { description: "Mahasiswa / tesis tidak ditemukan" },
        },
      },
    },
    "/thesis/{id}": {
      get: {
        tags: ["Thesis"],
        summary: "Ambil detail tesis berdasarkan ID tesis",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Detail tesis" },
          404: { description: "Tesis tidak ditemukan" },
        },
      },
    },
    "/thesis": {
      get: {
        tags: ["Thesis"],
        summary: "Daftar semua tesis bimbingan (Dosen) atau seluruh tesis prodi (Koordinator/Admin/Kepala Prodi)",
        responses: {
          200: { description: "Daftar tesis" },
        },
      },
    },
    "/logbooks": {
      get: {
        tags: ["Logbooks"],
        summary: "Daftar riwayat bimbingan logbook",
        parameters: [
          { name: "thesisId", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Daftar entri logbook beserta status validasi dari seluruh pembimbing" },
        },
      },
      post: {
        tags: ["Logbooks"],
        summary: "Buat logbook bimbingan baru (Mahasiswa)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LogbookInput" } } },
        },
        responses: {
          201: { description: "Logbook berhasil dibuat" },
          400: { description: "Validasi input gagal" },
        },
      },
    },
    "/logbooks/supervisors": {
      get: {
        tags: ["Logbooks"],
        summary: "Daftar dosen pembimbing yang ditugaskan untuk mahasiswa login",
        responses: {
          200: { description: "Daftar pembimbing aktif" },
        },
      },
    },
    "/logbooks/{id}": {
      get: {
        tags: ["Logbooks"],
        summary: "Detail lengkap logbook, versi, riwayat evaluasi, dan rekap validasi dosen pembimbing",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Detail logbook" },
          404: { description: "Logbook tidak ditemukan" },
        },
      },
      put: {
        tags: ["Logbooks"],
        summary: "Perbarui logbook yang berstatus DRAFT atau PERLU_REVISI",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LogbookInput" } } },
        },
        responses: {
          200: { description: "Logbook berhasil diperbarui" },
          403: { description: "Logbook tidak dapat diedit karena sudah disetujui / dalam proses" },
        },
      },
    },
    "/evaluations/queue": {
      get: {
        tags: ["Evaluations"],
        summary: "Antrean logbook yang membutuhkan validasi oleh dosen pembimbing login",
        responses: {
          200: { description: "Daftar logbook mahasiswa bimbingan yang menunggu validasi" },
        },
      },
    },
    "/evaluations": {
      post: {
        tags: ["Evaluations"],
        summary: "Kirim evaluasi dan keputusan validasi logbook (Pembimbing)",
        description: "Bila terdapat 2 dosen pembimbing, status logbook akan menjadi DISETUJUI hanya setelah kedua pembimbing menyetujuinya.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/EvaluationInput" } } },
        },
        responses: {
          200: { description: "Evaluasi berhasil disimpan" },
          400: { description: "Validasi evaluasi gagal" },
        },
      },
    },
    "/topics": {
      get: {
        tags: ["Research Topics"],
        summary: "Daftar topik riset tesis yang tersedia",
        responses: {
          200: { description: "Katalog topik riset" },
        },
      },
      post: {
        tags: ["Research Topics"],
        summary: "Tambah topik riset baru (Admin Prodi / Koordinator / Kepala Prodi / Pembimbing)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/TopicInput" } } },
        },
        responses: {
          201: { description: "Topik riset berhasil dibuat" },
        },
      },
    },
    "/topics/{id}": {
      get: {
        tags: ["Research Topics"],
        summary: "Detail topik riset berdasarkan ID",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Detail topik riset" },
          404: { description: "Topik tidak ditemukan" },
        },
      },
      delete: {
        tags: ["Research Topics"],
        summary: "Hapus topik riset (Admin Prodi / Koordinator / Kepala Prodi)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Topik berhasil dihapus" },
        },
      },
    },
    "/topics/{id}/select": {
      post: {
        tags: ["Research Topics"],
        summary: "Mahasiswa memilih topik riset (otomatis menetapkan tesis dan pembimbing)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Topik berhasil dipilih dan dijadikan judul tesis" },
          409: { description: "Kuota topik penuh atau ditutup" },
        },
      },
    },
    "/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "Daftar notifikasi pengguna yang sedang login",
        responses: {
          200: { description: "Daftar notifikasi dan jumlah unread" },
        },
      },
    },
    "/notifications/read-all": {
      post: {
        tags: ["Notifications"],
        summary: "Tandai seluruh notifikasi telah dibaca",
        responses: {
          200: { description: "Semua notifikasi ditandai dibaca" },
        },
      },
    },
    "/notifications/{id}/read": {
      post: {
        tags: ["Notifications"],
        summary: "Tandai satu notifikasi telah dibaca",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Notifikasi ditandai dibaca" },
        },
      },
    },
    "/seminars/eligibility": {
      get: {
        tags: ["Seminars"],
        summary: "Cek kelayakan pendaftaran seminar (syarat minimal 4x bimbingan disetujui)",
        responses: {
          200: { description: "Status kelayakan dan jumlah bimbingan disetujui" },
        },
      },
    },
    "/seminars/my": {
      get: {
        tags: ["Seminars"],
        summary: "Status pengajuan seminar milik mahasiswa yang sedang login",
        responses: {
          200: { description: "Data seminar dan evaluasi penguji" },
        },
      },
    },
    "/seminars": {
      get: {
        tags: ["Seminars"],
        summary: "Daftar pengajuan seminar (Penguji, Koordinator, Kepala Prodi)",
        responses: {
          200: { description: "Daftar seminar" },
        },
      },
      post: {
        tags: ["Seminars"],
        summary: "Pendaftaran seminar proposal thesis oleh mahasiswa (mengumpulkan link dokumen proposal)",
        responses: {
          201: { description: "Pendaftaran seminar berhasil diajukan" },
          400: { description: "Belum memenuhi syarat minimal 4x bimbingan" },
        },
      },
    },
    "/seminars/evaluate": {
      post: {
        tags: ["Seminars"],
        summary: "Penilaian seminar proposal oleh dosen penguji (wajib 2 orang penguji)",
        responses: {
          200: { description: "Penilaian penguji berhasil disimpan" },
        },
      },
    },
  },
};
