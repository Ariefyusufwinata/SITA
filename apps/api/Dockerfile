# Build context: root monorepo  (docker build -f apps/api/Dockerfile .)
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
ENV PORT=3000
EXPOSE 3000
RUN mkdir -p uploads
CMD ["bun", "src/index.ts"]
