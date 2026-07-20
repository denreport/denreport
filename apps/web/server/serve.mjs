import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

/** Resolves a URL path to an actual file path under rootDir.
 *  After normalization, a path that escapes rootDir (traversal) or contains a NUL byte returns null.
 *  "/" resolves to "/index.html".
 * @param {string} rootDir  @param {string} urlPath  @returns {string | null} */
export function resolveFilePath(rootDir, urlPath) {
  const withoutQuery = urlPath.split(/[?#]/)[0];
  let pathname;
  try {
    pathname = decodeURIComponent(withoutQuery);
  } catch {
    return null;
  }
  if (pathname.includes("\0")) {
    return null;
  }
  if (pathname === "/") {
    pathname = "/index.html";
  }

  const root = normalize(rootDir);
  const resolved = normalize(join(root, pathname));
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    return null;
  }
  return resolved;
}

/** Returns the Content-Type for an extension. Supported: .html .js .css .json .png .svg .ttf .txt .map.
 *  An unknown extension returns "application/octet-stream".
 * @param {string} filePath  @returns {string} */
export function contentTypeFor(filePath) {
  const ext = extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function cacheControlFor(urlPath) {
  return urlPath.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache";
}

function sendNotFound(res, method) {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end(method === "HEAD" ? undefined : "Not Found");
}

/** Creates a request handler. Only GET/HEAD are allowed (others get 405).
 *  "/healthz" -> 200 text/plain "ok". Nonexistent file -> 404.
 *  Cache-Control: under "/assets/" it is public, max-age=31536000, immutable (hashed file names);
 *  otherwise (index.html etc.) it is no-cache.
 * @param {{ rootDir: string }} options
 * @returns {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void} */
export function createHandler(options) {
  const { rootDir } = options;

  return function handleRequest(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }

    const urlPath = req.url ?? "/";

    if (urlPath === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : "ok");
      return;
    }

    const filePath = resolveFilePath(rootDir, urlPath);
    if (filePath === null) {
      sendNotFound(res, req.method);
      return;
    }

    stat(filePath)
      .then((stats) => {
        if (!stats.isFile()) {
          sendNotFound(res, req.method);
          return;
        }
        res.writeHead(200, {
          "content-type": contentTypeFor(filePath),
          "content-length": String(stats.size),
          "cache-control": cacheControlFor(urlPath),
        });
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        createReadStream(filePath).pipe(res);
      })
      .catch(() => sendNotFound(res, req.method));
  };
}

function main() {
  const port = Number(process.env.PORT) || 8080;
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
  const server = createServer(createHandler({ rootDir }));
  server.listen(port, "0.0.0.0", () => {
    console.log(`listening on http://0.0.0.0:${port}`);
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
