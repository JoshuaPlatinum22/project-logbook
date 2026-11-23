// Project Logbook: a tiny dependency-free server.
// Serves public/index.html and stores projects in a JSON file (DATA_DIR/projects.json).
// Set APP_PASSWORD to require a password (any username) before anyone can see the site.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "projects.json");
const PASSWORD = process.env.APP_PASSWORD || "";
const INDEX = fs.readFileSync(path.join(__dirname, "public", "index.html"));

fs.mkdirSync(DATA_DIR, { recursive: true });
let projects = {};
try { projects = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch (e) { projects = {}; }

let saving = Promise.resolve();
function persist() {
  const snapshot = JSON.stringify(projects);
  saving = saving.then(() => new Promise((resolve) => {
    const tmp = DATA_FILE + ".tmp";
    fs.writeFile(tmp, snapshot, (err) => {
      if (err) { console.error("save failed", err); return resolve(); }
      fs.rename(tmp, DATA_FILE, (err2) => { if (err2) console.error("rename failed", err2); resolve(); });
    });
  }));
  return saving;
}

function authorized(req) {
  if (!PASSWORD) return true;
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  const given = Buffer.from(h.slice(6), "base64").toString().split(":").slice(1).join(":");
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 1e6) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const STATUSES = ["active", "paused", "blocked", "done"];
const str = (v, max) => String(v ?? "").slice(0, max);
const num = (v) => (Number.isFinite(v) ? v : 0);
function clean(id, p) {
  return {
    id,
    name: str(p.name, 120) || "Untitled",
    status: STATUSES.includes(p.status) ? p.status : "active",
    upTo: str(p.upTo, 20000),
    upToAt: num(p.upToAt),
    notes: (Array.isArray(p.notes) ? p.notes : []).slice(0, 2000).map((n) => ({ id: str(n.id, 64), text: str(n.text, 20000), at: num(n.at) })),
    createdAt: num(p.createdAt) || Date.now(),
    updatedAt: num(p.updatedAt) || Date.now(),
  };
}

http.createServer(async (req, res) => {
  if (req.url === "/healthz") return send(res, 200, { ok: true });
  if (!authorized(req)) {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Project Logbook"', "Content-Type": "text/plain" });
    return res.end("Password required");
  }
  const url = new URL(req.url, "http://x");
  const m = url.pathname.match(/^\/api\/projects(?:\/([^/]+))?$/);
  try {
    if (m) {
      const id = m[1] ? decodeURIComponent(m[1]) : null;
      if (!id && req.method === "GET") return send(res, 200, Object.values(projects));
      if (id && !ID.test(id)) return send(res, 400, { error: "bad id" });
      if (id && req.method === "PUT") {
        const body = JSON.parse(await readBody(req));
        projects[id] = clean(id, body);
        await persist();
        return send(res, 200, projects[id]);
      }
      if (id && req.method === "DELETE") {
        delete projects[id];
        await persist();
        return send(res, 200, { ok: true });
      }
      return send(res, 405, { error: "method not allowed" });
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return send(res, 200, INDEX, "text/html; charset=utf-8");
    }
    send(res, 404, "Not found", "text/plain");
  } catch (e) {
    send(res, 400, { error: "bad request" });
  }
}).listen(PORT, () => console.log(`Project Logbook on port ${PORT}, data in ${DATA_FILE}${PASSWORD ? ", password on" : ""}`));
