const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const defaultDataDirectory = path.join(root, "data");
const contentTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function readRequestBody(request, maxBytes = 10_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        reject(Object.assign(new Error("Permintaan terlalu besar."), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function createServer({ dataDirectory = defaultDataDirectory, whatsappNumber = process.env.WHATSAPP_NUMBER || "08127289020", frontendOrigin = process.env.FRONTEND_ORIGIN || "" } = {}) {
  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (frontendOrigin && request.headers.origin === frontendOrigin) {
      response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.setHeader("Access-Control-Max-Age", "600");
      response.setHeader("Vary", "Origin");
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      return response.end();
    }
    if (request.method === "GET" && pathname === "/api/health") return sendJson(response, 200, { status: "ok" });
    if (request.method === "GET" && pathname === "/api/config") return sendJson(response, 200, { whatsappNumber: whatsappNumber.replace(/\D/g, "") });

    if (request.method === "GET" && pathname === "/api/articles") {
      try {
        const content = await fs.promises.readFile(path.join(dataDirectory, "articles.jsonl"), "utf8");
        const articles = content.split("\n").filter(Boolean).map((line) => JSON.parse(line)).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
        return sendJson(response, 200, { articles });
      } catch (error) {
        if (error.code === "ENOENT") return sendJson(response, 200, { articles: [] });
        return sendJson(response, 500, { error: "Daftar artikel tidak dapat dimuat." });
      }
    }

    const pdfMatch = pathname.match(/^\/uploads\/([\da-f-]{36})\.pdf$/i);
    if (request.method === "GET" && pdfMatch) {
      const filePath = path.join(dataDirectory, "articles", `${pdfMatch[1]}.pdf`);
      return fs.readFile(filePath, (error, content) => {
        if (error) { response.writeHead(404); return response.end("Artikel tidak ditemukan."); }
        response.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pdfMatch[1]}.pdf"`, "X-Content-Type-Options": "nosniff" });
        response.end(content);
      });
    }

    if (request.method === "POST" && pathname === "/api/articles") {
      if (!request.headers["content-type"]?.includes("application/json")) return sendJson(response, 415, { error: "Gunakan format JSON." });
      try {
        const payload = JSON.parse(await readRequestBody(request, 50_000));
        const title = typeof payload.title === "string" ? payload.title.trim() : "";
        const content = typeof payload.content === "string" ? payload.content.trim() : "";
        const rawKeywords = typeof payload.keywords === "string" ? payload.keywords : "";
        const keywordEntries = rawKeywords.split(",").map((keyword) => keyword.trim()).filter(Boolean);
        const keywords = [...new Map(keywordEntries.map((keyword) => [keyword.toLocaleLowerCase("id"), keyword])).values()];
        if (!title || title.length > 160) return sendJson(response, 400, { error: "Judul berita wajib diisi dan maksimal 160 karakter." });
        if (!content || content.length > 10_000) return sendJson(response, 400, { error: "Isi berita wajib diisi dan maksimal 10.000 karakter." });
        if (keywords.length !== 3 || keywords.some((keyword) => keyword.length > 40)) return sendJson(response, 400, { error: "Isi tepat 3 kata kunci yang berbeda; setiap kata kunci maksimal 40 karakter." });
        const id = crypto.randomUUID();
        const uploadedAt = new Date().toISOString();
        const article = { id, title, content, keywords, uploadedAt };
        await fs.promises.mkdir(dataDirectory, { recursive: true });
        await fs.promises.appendFile(path.join(dataDirectory, "articles.jsonl"), `${JSON.stringify(article)}\n`, "utf8");
        return sendJson(response, 201, { article });
      } catch (error) {
        if (error.statusCode) return sendJson(response, error.statusCode, { error: error.message });
        if (error instanceof SyntaxError) return sendJson(response, 400, { error: "Format data tidak valid." });
        return sendJson(response, 500, { error: "Artikel tidak dapat disimpan." });
      }
    }

    if (request.method === "POST" && pathname === "/api/contact") {
      if (!request.headers["content-type"]?.includes("application/json")) return sendJson(response, 415, { error: "Gunakan format JSON." });
      try {
        const payload = JSON.parse(await readRequestBody(request));
        const name = typeof payload.name === "string" ? payload.name.trim() : "";
        const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
        const destination = typeof payload.destination === "string" ? payload.destination.trim() : "";
        const date = typeof payload.date === "string" ? payload.date.trim() : "";
        const message = typeof payload.message === "string" ? payload.message.trim() : "";
        if (!name || !phone || !destination) return sendJson(response, 400, { error: "Nama, nomor WhatsApp, dan tujuan wajib diisi." });
        if (name.length > 100 || phone.length > 30 || destination.length > 100 || date.length > 30 || message.length > 1000) return sendJson(response, 400, { error: "Ada isian yang melebihi batas karakter." });
        const inquiry = { id: require("node:crypto").randomUUID(), name, phone, destination, date, message, createdAt: new Date().toISOString() };
        await fs.promises.mkdir(dataDirectory, { recursive: true });
        await fs.promises.appendFile(path.join(dataDirectory, "inquiries.jsonl"), `${JSON.stringify(inquiry)}\n`, "utf8");
        return sendJson(response, 201, { ok: true, message: "Rencana perjalanan berhasil dikirim." });
      } catch (error) {
        if (error.statusCode) return sendJson(response, error.statusCode, { error: error.message });
        if (error instanceof SyntaxError) return sendJson(response, 400, { error: "Format data tidak valid." });
        return sendJson(response, 500, { error: "Terjadi kendala saat menyimpan permintaan." });
      }
    }

    if (request.method !== "GET" && request.method !== "HEAD") return sendJson(response, 405, { error: "Metode tidak didukung." });
    const requestedPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
    const filePath = path.resolve(root, `.${requestedPath}`);
    if (!filePath.startsWith(`${root}${path.sep}`) || !contentTypes[path.extname(filePath)]) {
      response.writeHead(404);
      return response.end("Not found");
    }
    fs.readFile(filePath, (error, content) => {
      if (error) { response.writeHead(404); return response.end("Not found"); }
      response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] });
      response.end(request.method === "HEAD" ? undefined : content);
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => console.log(`Terra Tour berjalan di http://localhost:${port}`));
}

module.exports = { createServer };