# SITA — Sistem Integrasi Tracking Akademik (Security Level 1 / Dev Mode)

Monorepo pnpm: `apps/api` (Hono + Drizzle), `apps/web` (React + TanStack), `packages/shared` (Zod & enum).

## Menjalankan
```bash
bun install
createdb sita_msf                 # PostgreSQL lokal
# .env (di root proyek) -> DATABASE_URL, JWT_SECRET, PORT (lihat .env.example)
pnpm db:push && pnpm db:seed      # skema 29 tabel + data awal
bun run dev                       # Buka http://localhost:3000 (FE & BE)
```
- Web Application: http://localhost:3000
- Swagger API Docs: http://localhost:3000/api/docs (atau http://localhost:3000/docs)
- OpenAPI Specification: http://localhost:3000/api/openapi.json
- Login: halaman `/login` (Quick Role Switcher) atau `POST /api/auth/dev-login`.
Akun seed: NIM 2231001 & 2231002 (Mahasiswa), NIP 19800101 (Pembimbing+Koordinator), 19750505 (Penguji), admin.prodi@ & admin.ti@telkomuniversity.ac.id.

## Kerentanan Saat Ini (Testing Lab / Security Level 1)

Aplikasi SITA saat ini sengaja dikonfigurasi dalam status **Security Level 1 (Vulnerable by Design)** untuk keperluan pengujian keamanan, riset pentest, dan simulasi laboratorium. Rincian metodologi evaluasi standar OWASP WSTG dapat dilihat pada [VULNERABILITY_CATALOG.md](VULNERABILITY_CATALOG.md).

Berikut adalah ringkasan kerentanan aktif yang dapat diuji:

| No | Kategori Kerentanan | Titik Pengujian (Endpoint / Komponen) | Dampak & Mekanisme Teknis |
|---|---|---|---|
| 1 | **IDOR (BOLA) — Profil & Tesis** | `GET /api/thesis/student/:nim`<br>`GET /api/thesis/:id` | Mengakses data pribadi mahasiswa dan rincian tesis orang lain tanpa validasi kepemilikan objek (*Object Ownership*). |
| 2 | **IDOR (BOLA) — Modul Logbook** | `GET /api/logbooks/:id`<br>`PUT /api/logbooks/:id`<br>`DELETE /api/logbooks/:id` | Membaca, mengubah, atau menghapus catatan logbook milik mahasiswa lain selama statusnya masih `DRAFT`/`PERLU_REVISI`. |
| 3 | **Privilege Escalation (BFLA)** | Frontend: `localStorage['sita_role']`<br>Backend: Header `X-User-Role` | Manipulasi peran pengguna secara horizontal/vertikal; backend mempercayai override peran langsung dari header klien. |
| 4 | **Ketiadaan Proteksi Brute Force** | `POST /api/auth/login` | Tidak ada *rate limiting*, delay eksponensial, atau penguncian akun (memungkinkan enumerasi kredensial dan serangan kamus). |
| 5 | **Insecure Session & Token Storage** | Penyimpanan JWT di `localStorage` | JWT memiliki masa aktif statis 24 jam tanpa mekanisme rotasi *refresh token*, rentan terhadap pencurian token (*token theft/XSS*). |
| 6 | **Transmisi Payload Terbuka** | Seluruh rute API (`/api/*`) | Transmisi data JSON mentah tanpa enkripsi pada tingkat aplikasi (*Application-Level Encryption*). |
| 7 | **Validasi Berkas Tingkat Dasar** | `POST /api/logbooks` (Attachment) | Validasi lampiran hanya memeriksa ekstensi string nama berkas tanpa inspeksi tanda tangan biner (*magic bytes*). |

## Docker
```bash
docker compose up -d --build
docker compose exec api bunx drizzle-kit push --force   # buat skema (sekali)
docker compose exec api bun src/db/seed.ts              # data awal
```
Buka http://localhost:3000 (nginx menyajikan web & memproxy `/api` ke container `api`).

### Docker biasa (tanpa compose)
```bash
./docker-run.sh up      # build image, buat network, jalankan db + api + web
./docker-run.sh init    # sekali: skema + seed
./docker-run.sh down    # hentikan & hapus container
```

## Dokploy
Gunakan `docker-compose.yml` (tipe Compose); domain → service `web` port 3000 (atau 80). Setelah deploy, jalankan sekali di terminal container `api`: `bunx drizzle-kit push --force` lalu `bun src/db/seed.ts`.

## Kredensial Pengguna (Testing Lab)
Format Username: huruf kecil tanpa titik, angka, atau karakter khusus (`[a-z]`).
Format Password: `<username>@<NIM/NIP>` (atau `@adminprodi` / `@adminti`).

| Nama Akun | Username | Password | Peran (*Role*) |
|---|---|---|---|
| Andi Pratama | `andipratama` | `andipratama@2231001` | Mahasiswa (5x Bimbingan Disetujui, Siap Seminar) |
| Siti Nurhaliza | `sitinurhaliza` | `sitinurhaliza@2231002` | Mahasiswa (0x Bimbingan Disetujui) |
| Rizky Pratama | `rizkypratama` | `rizkypratama@2231003` | Mahasiswa (Akun Baru - Belum Memilih Topik) |
| Dr. Budi Santoso, M.T. | `budisantoso` | `budisantoso@19800101` | Pembimbing, Koordinator, Kepala Prodi, Penguji, & Admin Prodi (5 Peran, Kuota: 4) |
| Prof. Dewi Anggraini, Ph.D. | `dewianggraini` | `dewianggraini@19750505` | Penguji & Pembimbing (Kuota: 3) |
| Dr. Hendra Gunawan, M.Kom. | `hendragunawan` | `hendragunawan@19850601` | Dosen Pembimbing (Akun Baru - 0 Bimbingan, Kuota: 3) |
| Rina Wulandari | `rinawulandari` | `rinawulandari@adminprodi` | Admin Prodi |
| Teguh Wibowo | `teguhwibowo` | `teguhwibowo@adminti` | Admin TI |
