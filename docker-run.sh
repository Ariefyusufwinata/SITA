#!/usr/bin/env bash
# Versi docker biasa (tanpa compose). Pakai: ./docker-run.sh up|down|init
set -euo pipefail
NET=sita-net

case "${1:-up}" in
  up)
    docker network inspect $NET >/dev/null 2>&1 || docker network create $NET
    docker build -f apps/api/Dockerfile -t sita-api .
    docker build -f apps/web/Dockerfile -t sita-web .

    docker run -d --name db --network $NET \
      -e POSTGRES_DB=sita_msf -e POSTGRES_USER=sita -e POSTGRES_PASSWORD=sita \
      -v sita-pgdata:/var/lib/postgresql/data \
      postgres:16-alpine
    until docker exec db pg_isready -U sita -d sita_msf >/dev/null 2>&1; do sleep 1; done

    # nama container "api" harus tetap, karena dipakai nginx (proxy_pass http://api:3000)
    docker run -d --name api --network $NET \
      -e DATABASE_URL=postgres://sita:sita@db:5432/sita_msf \
      -e JWT_SECRET=dev-secret-change-me -e PORT=3000 \
      -v sita-uploads:/app/apps/api/uploads \
      sita-api

    docker run -d --name web --network $NET -p 3000:80 sita-web
    echo "Selesai. Jalankan './docker-run.sh init' sekali untuk membuat skema + seed, lalu buka http://localhost:3000"
    ;;
  init)
    docker exec api bunx drizzle-kit push --force
    docker exec api bun src/db/seed.ts
    ;;
  down)
    docker rm -f web api db 2>/dev/null || true
    docker network rm $NET 2>/dev/null || true
    echo "Container dihapus (volume data tetap ada; hapus dengan: docker volume rm sita-pgdata sita-uploads)"
    ;;
  *) echo "Usage: $0 up|init|down"; exit 1 ;;
esac
