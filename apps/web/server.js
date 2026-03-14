import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { orchestrateJudgePanel } from "../ai-service/src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const port = Number(process.env.PORT || "3000");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function resolveRequestPath(urlPath) {
  const normalized = decodeURIComponent(urlPath.split("?")[0]);
  if (normalized === "/") {
    return path.join(repoRoot, "apps", "web", "index.html");
  }

  const cleanPath = normalized.replace(/^\/+/, "");
  const absolutePath = path.resolve(repoRoot, cleanPath);

  if (!absolutePath.startsWith(repoRoot)) {
    return null;
  }

  return absolutePath;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    request.on("error", reject);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "POST" && url.pathname === "/api/judge-bundle") {
    readJsonBody(request)
      .then((payload) => orchestrateJudgePanel(payload))
      .then((bundle) => {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(bundle));
      })
      .catch((error) => {
        response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: error.message }));
      });
    return;
  }

  const filePath = resolveRequestPath(url.pathname);

  if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const extension = path.extname(filePath);
  const contentType = contentTypes[extension] || "text/plain; charset=utf-8";

  response.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      [
        `Port ${port} is already in use.`,
        "Stop the process using that port or run the demo on another port.",
        "PowerShell example:",
        "  $env:PORT=3001",
        "  npm run dev:web"
      ].join("\n")
    );
    process.exit(1);
  }

  throw error;
});

server.listen(port, () => {
  console.log(`SharkTank demo running at http://localhost:${port}`);
});
