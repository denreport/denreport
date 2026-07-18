import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentTypeFor, createHandler, resolveFilePath } from "./serve.mjs";

describe("resolveFilePath", () => {
  const rootDir = "/app/dist";

  it("/ を /index.html として解決する", () => {
    expect(resolveFilePath(rootDir, "/")).toBe("/app/dist/index.html");
  });

  it("通常のパスを rootDir 配下へ解決する", () => {
    expect(resolveFilePath(rootDir, "/assets/app.js")).toBe(
      "/app/dist/assets/app.js",
    );
  });

  it("rootDir の外へ出るパスは null を返す", () => {
    expect(resolveFilePath(rootDir, "/../../etc/passwd")).toBeNull();
  });

  it("エンコード済みのトラバーサルは null を返す", () => {
    expect(resolveFilePath(rootDir, "/%2e%2e/%2e%2e/etc/passwd")).toBeNull();
  });

  it("NUL 混入は null を返す", () => {
    expect(resolveFilePath(rootDir, "/index.html%00.png")).toBeNull();
  });

  it("root 内で完結する .. は解決される", () => {
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

  it("未知の拡張子は application/octet-stream", () => {
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

  it("GET / は index.html を返す", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await res.text()).toContain('id="app"');
  });

  it("GET /assets/ 配下は immutable な Cache-Control を返す", async () => {
    const res = await fetch(`${baseUrl}/assets/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("HEAD はボディなしで 200 を返す", async () => {
    const res = await fetch(`${baseUrl}/`, { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("GET/HEAD 以外は 405 を返す", async () => {
    const res = await fetch(`${baseUrl}/`, { method: "POST" });
    expect(res.status).toBe(405);
  });

  it("未存在ファイルは 404 を返す", async () => {
    const res = await fetch(`${baseUrl}/no-such-file.txt`);
    expect(res.status).toBe(404);
  });

  it("/healthz は 200 で ok を返す", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
