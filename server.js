const fs = require("fs");
const http = require("http");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.JOURNAL_PASSWORD || "Kevpatty";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "journal-entries.json");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ entries: [] }, null, 2));
  }
}

function readEntries() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")).entries || [];
}

function writeEntries(entries) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ entries }, null, 2));
}

function hasValidPassword(request) {
  return request.headers["x-journal-password"] === PASSWORD;
}

async function handleJournalApi(request, response) {
  if (!hasValidPassword(request)) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const entryId = decodeURIComponent(url.pathname.replace("/api/journal/", ""));

  if (request.method === "GET") {
    sendJson(response, 200, { entries: readEntries() });
    return;
  }

  if (request.method === "POST") {
    const now = new Date().toISOString();
    const body = JSON.parse(await readBody(request));
    const entries = readEntries();
    const entry = {
      id: body.id || randomUUID(),
      title: String(body.title || ""),
      body: String(body.body || ""),
      updatedAt: now
    };
    const existingIndex = entries.findIndex((item) => item.id === entry.id);

    if (existingIndex >= 0) {
      entry.createdAt = entries[existingIndex].createdAt || now;
      entries[existingIndex] = entry;
    } else {
      entry.createdAt = now;
      entries.unshift(entry);
    }

    entries.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    writeEntries(entries);
    sendJson(response, 200, { entry, entries });
    return;
  }

  if (request.method === "DELETE" && entryId && entryId !== "/api/journal") {
    const entries = readEntries();
    const filteredEntries = entries.filter((item) => item.id !== entryId);

    if (filteredEntries.length === entries.length) {
      sendJson(response, 404, { error: "Entry not found" });
      return;
    }

    writeEntries(filteredEntries);
    sendJson(response, 200, { entries: filteredEntries });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === "/api/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.url.startsWith("/api/journal")) {
      await handleJournalApi(request, response);
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Pllugi website running at http://localhost:${PORT}`);
});
