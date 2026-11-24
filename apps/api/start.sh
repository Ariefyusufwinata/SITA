#!/usr/bin/env bash
set -e

echo "=== SITA API: Sinkronisasi Skema Basis Data ==="
bunx drizzle-kit push --force || true

echo "=== SITA API: Pemeriksaan & Inisialisasi Data Awal ==="
bun src/db/init.ts || true

echo "=== SITA API: Menjalankan Server ==="
exec bun src/index.ts
