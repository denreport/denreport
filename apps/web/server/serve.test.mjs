import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentTypeFor, createHandler, resolveFilePath } from "./serve.mjs";

describe("resolveFilePath", () => {
  const rootDir = "/app/dist";

  it("resolves / to /index.html", () => {
    expect(resolveFilePath(rootDir, "/")).toBe("/app/dist/index.html");
  });

  it("resolves a normal path under rootDir", () => {
    expect(resolveFilePath(rootDir, "/assets/app.js")).toBe(
      "/app/dist/assets/app.js",
    );
  });

  it("returns null for a path that escapes rootDir", () => {
    expect(resolveFilePath(rootDir, "/../../etc/passwd")).toBeNull();
  });

  it("returns null for an encoded traversal", () => {
    expect(resolveFilePath(rootDir, "/%2e%2e/%2e%2e/etc/passwd")).toBeNull();
  });

  it("returns null when NUL is embedded", () => {
    expect(resolveFilePath(rootDir, "/index.html%00.png")).toBeNull();
  });

  it("resolves .. that stays within root", () => {
    expect(resolveFilePath(rootDir, "/assets/../index.html")).toBe(
      "/app/dist/index.html",
    );
  });
});

describe("contentTypeFor", () => {
  it.each([
    ["/dist/index.html", "text/html; charset=utf-8"],
    ["/dist/main.js", "text/javascript; charset=utf-8"],
    ["/dist/app.css", "text/css; charset=utf-8"],
    ["/dist/manifest.json", "application/json; charset=utf-8"],
    ["/dist/logo.png", "image/png"],
    ["/dist/icon.svg", "image/svg+xml"],
    ["/dist/font.ttf", "font/ttf"],
    ["/dist/notice.txt", "text/plain; charset=utf-8"],
    ["/dist/main.js.map", "application/json; charset=utf-8"],
  ])("%s -> %s", (filePath, expected) => {
    expect(contentTypeFor(filePath)).toBe(expected);
  });

  it("unknown extensions return application/octet-stream", () => {
    expect(contentTypeFor("/dist/report.pdf")).toBe("application/octet-stream");
  });
});

describe("createHandler", () => {
  /** @type {string} */
  let rootDir;
  /** @type {import("node:http").Server} */
  let server;
  /** @type {string} */
  let baseUrl;

  beforeAll(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "serve-test-"));
    await writeFile(join(rootDir, "index.html"), '<div id="app"></div>');
    await mkdir(join(rootDir, "assets"));
    await writeFile(join(rootDir, "assets", "app.js"), "console.log(1)");

    server = createServer(createHandler({ rootDir }));
    await new Promise((resolveReady) => {
      server.listen(0, "127.0.0.1", resolveReady);
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise((resolveClosed) => server.close(resolveClosed));
    await rm(rootDir, { recursive: true, force: true });
  });

  it("GET / returns index.html", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await res.text()).toContain('id="app"');
  });

  it("GET /assets/ returns an immutable Cache-Control", async () => {
    const res = await fetch(`${baseUrl}/assets/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("HEAD returns 200 with no body", async () => {
    const res = await fetch(`${baseUrl}/`, { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("returns 405 for methods other than GET/HEAD", async () => {
    const res = await fetch(`${baseUrl}/`, { method: "POST" });
    expect(res.status).toBe(405);
  });

  it("returns 404 for a non-existent file", async () => {
    const res = await fetch(`${baseUrl}/no-such-file.txt`);
    expect(res.status).toBe(404);
  });

  it("/healthz returns 200 with ok", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
