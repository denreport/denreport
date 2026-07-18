# syntax=docker/dockerfile:1
FROM node:26-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583 AS builder

RUN corepack enable && corepack prepare pnpm@11.13.0 --activate

WORKDIR /build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @denreport/web run build

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:af85d11ce7ef10172855a6e3649e3e8125b1b9e3ca41849ec2918036f05cb212

WORKDIR /app
COPY --from=builder /build/apps/web/dist ./dist
COPY apps/web/server/serve.mjs ./server/serve.mjs

ENV PORT=8080
EXPOSE 8080
CMD ["server/serve.mjs"]
