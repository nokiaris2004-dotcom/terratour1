const form = document.querySelector("#inquiry-form");
const feedback = document.querySelector(".form-feedback");
const toast = document.querySelector(".toast");
const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");
let whatsappNumber = "628127289020";
const apiBase = document.querySelector('meta[name="api-base"]').content.trim().replace(/\/+$/, "");
const apiUrl = (path) => `${apiBase}/${path}`;

document.querySelector("#year").textContent = new Date().getFullYear();

fetch(apiUrl("api/config"))
  .then((response) => response.ok ? response.json() : Promise.reject())
  .then((config) => { whatsappNumber = config.whatsappNumber || ""; })
  .catch(() => {});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 3800);
}

document.querySelectorAll(".whatsapp-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (!whatsappNumber) {
      showToast("Nomor WhatsApp belum diatur. Silakan kirim rencana lewat formulir.");
      document.querySelector("#kontak").scrollIntoView({ behavior: "smooth" });
      return;
    }
    const message = encodeURIComponent(link.dataset.message || "Halo Terra Tour!");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank", "noopener,noreferrer");
  });
});

menuToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector("button[type='submit']");
  const data = Object.fromEntries(new FormData(form).entries());
  submitButton.disabled = true;
  feedback.textContent = "Mengirim rencana perjalanan...";

  try {
    const response = await fetch("api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Rencana belum berhasil dikirim.");
    feedback.textContent = "Rencana terkirim. Tim Terra Tour akan segera menghubungimu.";
    form.reset();
    if (whatsappNumber) {
      const message = encodeURIComponent(`Halo Terra Tour, saya ${data.name} (${data.phone}) tertarik dengan ${data.destination}. ${data.message || ""}`);
      window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank", "noopener,noreferrer");
    }
  } catch (error) {
    feedback.textContent = error.message || "Tidak dapat terhubung. Coba lagi sebentar.";
  } finally {
    submitButton.disabled = false;
  }
});

const articleList = document.querySelector("#article-list");
const articleUpload = document.querySelector("#article-upload");
const uploadToggle = document.querySelector("#article-add-toggle");
const articleSearch = document.querySelector("#article-search");
let articleRecords = [];

function renderArticles() {
  articleList.replaceChildren();
  const query = articleSearch.value.trim().toLocaleLowerCase("id");
  const articles = articleRecords.filter((article) => {
    const searchable = [article.title, article.content, ...(article.keywords || [])].join(" ").toLocaleLowerCase("id");
    return searchable.includes(query);
  });
  if (!articles.length) {
    const empty = document.createElement("p");
    empty.className = "article-empty";
    empty.textContent = articleRecords.length
      ? "Belum ada berita yang cocok. Coba kata kunci lain."
      : "Belum ada berita terbit. Jadilah yang pertama membagikan cerita Lampung.";
    articleList.append(empty);
    return;
  }

  articles.forEach((article) => {
    const entry = document.createElement("article");
    entry.className = "article-entry";
    const date = document.createElement("span");
    date.className = "article-date";
    date.textContent = new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(article.uploadedAt));
    const title = document.createElement("h3");
    title.textContent = article.title;
    entry.append(date, title);

    if (article.content) {
      const preview = document.createElement("p");
      preview.className = "article-preview";
      preview.textContent = article.content.length > 260 ? `${article.content.slice(0, 260).trimEnd()}…` : article.content;
      entry.append(preview);

      if (article.content.length > 260) {
        const details = document.createElement("details");
        details.className = "article-details";
        const summary = document.createElement("summary");
        summary.textContent = "Baca selengkapnya";
        const content = document.createElement("p");
        content.textContent = article.content;
        details.append(summary, content);
        entry.append(details);
      }
    } else if (article.fileName) {
      const filename = document.createElement("p");
      filename.textContent = article.fileName;
      entry.append(filename);
    }

    if (Array.isArray(article.keywords) && article.keywords.length) {
      const keywords = document.createElement("ul");
      keywords.className = "article-keywords";
      article.keywords.forEach((keyword) => {
        const item = document.createElement("li");
        item.textContent = keyword;
        keywords.append(item);
      });
      entry.append(keywords);
    }

    if (article.url) {
      const link = document.createElement("a");
      link.className = "article-read";
      link.href = new URL(article.url, apiBase || window.location.href).href;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Baca jurnal PDF ↗";
      entry.append(link);
    }
    articleList.append(entry);
  });
}

async function loadArticles() {
  try {
    const response = await fetch(apiUrl("api/articles"));
    if (!response.ok) throw new Error();
    const result = await response.json();
    articleRecords = result.articles || [];
    renderArticles();
  } catch {
    const empty = document.createElement("p");
    empty.className = "article-empty";
    empty.textContent = "Daftar artikel tersedia saat website dijalankan melalui server Terra Tour.";
    articleList.replaceChildren(empty);
  }
}

articleSearch.addEventListener("input", renderArticles);

uploadToggle.addEventListener("click", () => {
  const isOpen = articleUpload.hidden;
  articleUpload.hidden = !isOpen;
  uploadToggle.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) articleUpload.querySelector("input[name='title']").focus();
});

document.querySelector("#article-upload-close").addEventListener("click", () => {
  articleUpload.hidden = true;
  uploadToggle.setAttribute("aria-expanded", "false");
});

articleUpload.addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = articleUpload.querySelector(".upload-feedback");
  const submitButton = articleUpload.querySelector("button[type='submit']");
  const formData = new FormData(articleUpload);
  const keywords = String(formData.get("keywords"))
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  if (keywords.length !== 3 || new Set(keywords.map((keyword) => keyword.toLocaleLowerCase("id"))).size !== 3) {
    feedback.textContent = "Masukkan tepat 3 kata kunci yang berbeda dan pisahkan dengan koma.";
    return;
  }
  submitButton.disabled = true;
  feedback.textContent = "Menerbitkan berita...";
  try {
    const response = await fetch(apiUrl("api/articles"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formData.get("title"),
        content: formData.get("content"),
        keywords: keywords.join(", "),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Berita belum berhasil diterbitkan.");
    articleUpload.reset();
    feedback.textContent = "Berita berhasil diterbitkan.";
    await loadArticles();
  } catch (error) {
    feedback.textContent = error.message || "Tidak dapat terhubung. Coba lagi sebentar.";
  } finally {
    submitButton.disabled = false;
  }
});

loadArticles();