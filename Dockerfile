# syntax=docker/dockerfile:1
FROM node:24-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS builder

RUN corepack enable && corepack prepare pnpm@11.13.0 --activate

WORKDIR /build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @denreport/web run build

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:af85d11ce7ef10172855a6e3649e3e8125b1b9e3ca41849ec2918036f05cb212

LABEL org.opencontainers.image.source="https://github.com/denreport/denreport" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.description="denreport — a web-based designer for business documents (invoices, delivery notes, receipts, and similar reports) (static self-host image)"

WORKDIR /app
COPY --from=builder /build/apps/web/dist ./dist
COPY apps/web/server/serve.mjs ./server/serve.mjs

ENV PORT=8080
EXPOSE 8080
CMD ["server/serve.mjs"]
