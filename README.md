# SITA — Rilis 1 (Security Level 1 / Dev Mode)

Monorepo pnpm: `apps/api` (Hono + Drizzle), `apps/web` (React + TanStack), `packages/shared` (Zod & enum).

## Menjalankan
```bash
bun install
createdb sita_msf                 # PostgreSQL lokal
# .env (di root proyek) -> DATABASE_URL, JWT_SECRET, PORT (lihat .env.example)
pnpm db:push && pnpm db:seed      # skema 29 tabel + data awal
pnpm dev:api                      # http://localhost:3000
pnpm dev:web                      # http://localhost:5173 (proxy /api -> :3000)
```
Login: halaman `/login` (Quick Role Switcher) atau `POST /api/v1/auth/dev-login`.
Akun seed: NIM 2231001 & 2231002 (Mahasiswa), NIP 19800101 (Pembimbing+Koordinator), 19750505 (Penguji), admin.prodi@ & admin.ti@telkomuniversity.ac.id.

## Catatan Level 1 (sengaja belum diperketat)
RBAC hanya cek role di JWT; tanpa ABAC/IDOR; upload lokal ke `apps/api/uploads` (ekstensi .pdf/.docx/.pptx); audit tanpa masking; tanpa rate limit/CSRF.

## Docker
```bash
docker compose up -d --build
docker compose exec api bunx drizzle-kit push --force   # buat skema (sekali)
docker compose exec api bun src/db/seed.ts              # data awal
```
Buka http://localhost:8080 (nginx menyajikan web & memproxy `/api` ke container `api`).

### Docker biasa (tanpa compose)
```bash
./docker-run.sh up      # build image, buat network, jalankan db + api + web
./docker-run.sh init    # sekali: skema + seed
./docker-run.sh down    # hentikan & hapus container
```

## Dokploy
Gunakan docker-compose.dokploy.yml (tipe Compose); domain → service `web` port 80. Setelah deploy, jalankan sekali di terminal container `api`: `bunx drizzle-kit push --force` lalu `bun src/db/seed.ts`.

## Kredensial Pengguna (Testing Lab)
Format Username: huruf kecil tanpa titik, angka, atau karakter khusus (`[a-z]`).
Format Password: `<username>@<NIM/NIP>` (atau `@adminprodi` / `@adminti`).

| Nama Akun | Username | Password | Peran (*Role*) |
|---|---|---|---|
| Andi Pratama | `andipratama` | `andipratama@2231001` | Mahasiswa |
| Siti Nurhaliza | `sitinurhaliza` | `sitinurhaliza@2231002` | Mahasiswa |
| Dr. Budi Santoso, M.T. | `budisantoso` | `budisantoso@19800101` | Pembimbing & Koordinator |
| Prof. Dewi Anggraini, Ph.D. | `dewianggraini` | `dewianggraini@19750505` | Penguji |
| Rina Wulandari | `rinawulandari` | `rinawulandari@adminprodi` | Admin Prodi |
| Teguh Wibowo | `teguhwibowo` | `teguhwibowo@adminti` | Admin TI |
