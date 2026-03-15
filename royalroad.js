// ═══════════════════════════════════════════════════════
//  LUMINA EXTENSION — Royal Road
//  Site: https://www.royalroad.com
//  Version: 1.0.0
// ═══════════════════════════════════════════════════════

export default {
  id: "royalroad",
  name: "Royal Road",
  baseUrl: "https://www.royalroad.com",

  _parse(html) {
    return new DOMParser().parseFromString(html, "text/html");
  },

  _url(path) {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return this.baseUrl + (path.startsWith("/") ? path : "/" + path);
  },

  _cleanText(text) {
    return text?.replace(/\s+/g, " ").trim() ?? "";
  },

  // ─── Novel listesi (Best Rated) ───────────────────────
  async getNovels(page = 1) {
    const res = await fetch(`${this.baseUrl}/fictions/best-rated?page=${page}`);
    const html = await res.text();
    const doc = this._parse(html);

    return Array.from(doc.querySelectorAll(".fiction-list-item")).map((el) => {
      const titleEl  = el.querySelector(".fiction-title a");
      const imgEl    = el.querySelector("img");
      const authorEl = el.querySelector(".author-name a, .author a");
      const tagsEl   = el.querySelectorAll(".tags .label");
      const synopsisEl = el.querySelector(".fiction-description p, .description p");

      const href = titleEl?.getAttribute("href") ?? "";
      const url  = this._url(href);

      return {
        id:       url,
        title:    this._cleanText(titleEl?.textContent ?? ""),
        url,
        coverUrl: imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? "",
        author:   this._cleanText(authorEl?.textContent ?? ""),
        synopsis: this._cleanText(synopsisEl?.textContent ?? ""),
        status:   "Ongoing",
        genres:   Array.from(tagsEl).map((t) => this._cleanText(t.textContent)),
      };
    }).filter((n) => n.url && n.title);
  },

  // ─── Arama ────────────────────────────────────────────
  async searchNovels(query, page = 1) {
    const q = encodeURIComponent(query);
    const res = await fetch(`${this.baseUrl}/fictions/search?title=${q}&page=${page}`);
    const html = await res.text();
    const doc  = this._parse(html);

    return Array.from(doc.querySelectorAll(".fiction-list-item")).map((el) => {
      const titleEl  = el.querySelector(".fiction-title a");
      const imgEl    = el.querySelector("img");
      const authorEl = el.querySelector(".author-name a, .author a");
      const href     = titleEl?.getAttribute("href") ?? "";
      const url      = this._url(href);

      return {
        id:       url,
        title:    this._cleanText(titleEl?.textContent ?? ""),
        url,
        coverUrl: imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? "",
        author:   this._cleanText(authorEl?.textContent ?? ""),
        status:   "Ongoing",
      };
    }).filter((n) => n.url && n.title);
  },

  // ─── Chapter listesi ──────────────────────────────────
  async getChapters(novelUrl) {
    const res  = await fetch(novelUrl);
    const html = await res.text();
    const doc  = this._parse(html);

    // RoyalRoad chapter listesi — tbody içindeki tr'ler
    const rows = doc.querySelectorAll(".chapter-list tr, table.chapters tr");

    const chapters = Array.from(rows).map((row, i) => {
      const linkEl = row.querySelector("a[href*='/chapter/']");
      const dateEl = row.querySelector("time");
      if (!linkEl) return null;

      const href  = linkEl.getAttribute("href") ?? "";
      const url   = this._url(href);

      return {
        id:            url,
        title:         this._cleanText(linkEl.textContent ?? `Chapter ${i + 1}`),
        url,
        date:          dateEl?.getAttribute("title") ?? dateEl?.textContent?.trim(),
        chapterNumber: i + 1,
      };
    }).filter(Boolean);

    return chapters;
  },

  // ─── Chapter içeriği ──────────────────────────────────
  async getChapterContent(chapterUrl) {
    const res  = await fetch(chapterUrl);
    const html = await res.text();
    const doc  = this._parse(html);

    // RoyalRoad chapter content container
    const content = doc.querySelector(".chapter-content");
    if (!content) return "İçerik yüklenemedi.";

    // Reklam ve gereksiz elementleri temizle
    content.querySelectorAll(
      "script, style, .ads, .adsbygoogle, [class*='ad-'], ins, .author-note-portlet"
    ).forEach((el) => el.remove());

    // Paragrafları al
    const paragraphs = content.querySelectorAll("p");
    if (paragraphs.length > 0) {
      return Array.from(paragraphs)
        .map((p) => p.textContent?.trim())
        .filter(Boolean)
        .join("\n\n");
    }

    return content.textContent?.trim() ?? "İçerik bulunamadı.";
  },
};
