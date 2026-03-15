// ═══════════════════════════════════════════════════════
//  LUMINA EXTENSION — Royal Road
//  Site: https://www.royalroad.com
//  Version: 2.0.0
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

  // HTML içinden window.X = ... değişkenlerini çek
  _extractWindowVar(html, varName) {
    const lines = html.split("\n");
    for (const line of lines) {
      if (line.includes(`window.${varName}`)) {
        const match = line.match(/=\s*(.+?);?\s*$/);
        if (match) {
          try { return JSON.parse(match[1].trim().replace(/;$/, "")); }
          catch { return null; }
        }
      }
    }
    return null;
  },

  // ─── Novel listesi ────────────────────────────────────
  async getNovels(page = 1) {
    const res = await fetch(
      `${this.baseUrl}/fictions/best-rated?page=${page}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const html = await res.text();
    const doc = this._parse(html);

    return Array.from(doc.querySelectorAll(".fiction-list-item")).map((el) => {
      const titleEl  = el.querySelector("h2.fiction-title a, .fiction-title a");
      const imgEl    = el.querySelector("img");
      const authorEl = el.querySelector(".author span[property='name'], .author a");
      const href     = titleEl?.getAttribute("href") ?? "";
      const url      = this._url(href);

      return {
        id:       url,
        title:    titleEl?.textContent?.trim() ?? "",
        url,
        coverUrl: imgEl?.getAttribute("data-src") ?? imgEl?.getAttribute("src") ?? "",
        author:   authorEl?.textContent?.trim() ?? "",
        status:   "Ongoing",
      };
    }).filter((n) => n.url && n.title);
  },

  // ─── Arama ────────────────────────────────────────────
  async searchNovels(query, page = 1) {
    const q = encodeURIComponent(query);
    const res = await fetch(
      `${this.baseUrl}/fictions/search?title=${q}&page=${page}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const html = await res.text();
    const doc  = this._parse(html);

    return Array.from(doc.querySelectorAll(".fiction-list-item")).map((el) => {
      const titleEl  = el.querySelector("h2.fiction-title a, .fiction-title a");
      const imgEl    = el.querySelector("img");
      const authorEl = el.querySelector(".author span[property='name'], .author a");
      const href     = titleEl?.getAttribute("href") ?? "";
      const url      = this._url(href);

      return {
        id:       url,
        title:    titleEl?.textContent?.trim() ?? "",
        url,
        coverUrl: imgEl?.getAttribute("data-src") ?? imgEl?.getAttribute("src") ?? "",
        author:   authorEl?.textContent?.trim() ?? "",
        status:   "Ongoing",
      };
    }).filter((n) => n.url && n.title);
  },

  // ─── Novel detayı ─────────────────────────────────────
  async getNovelDetail(novelUrl) {
    const res  = await fetch(novelUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const doc  = this._parse(html);

    // Kapak — window.fictionCover'dan
    const coverUrl = this._extractWindowVar(html, "fictionCover") ?? "";

    // Synopsis
    const synopsisEl = doc.querySelector(".fiction-description .description, .description .fiction-description");
    const synopsis   = synopsisEl?.textContent?.trim() ?? "";

    // Yazar
    const authorEl = doc.querySelector("span[property='author'] span[property='name'], .fiction-info .author");
    const author   = authorEl?.textContent?.trim() ?? "";

    // Status
    const statusEl = doc.querySelector(".label-sm.label-default, .fiction-status");
    const status   = statusEl?.textContent?.trim().toLowerCase().includes("ongoing") ? "Ongoing" : "Completed";

    return { coverUrl, synopsis, author, status };
  },

  // ─── Chapter listesi — window.chapters'dan ────────────
  async getChapters(novelUrl) {
    const res  = await fetch(novelUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();

    // window.chapters = [...] içindeki veriyi çek
    const chaptersData = this._extractWindowVar(html, "chapters");

    if (chaptersData && Array.isArray(chaptersData) && chaptersData.length > 0) {
      return chaptersData.map((ch, i) => ({
        id:            String(ch.id ?? i),
        title:         ch.title ?? `Chapter ${i + 1}`,
        url:           this._url(ch.url ?? ""),
        chapterNumber: i + 1,
        date:          ch.date ? new Date(ch.date * 1000).toLocaleDateString() : "",
      })).filter((ch) => ch.url);
    }

    // Fallback: HTML'den chapter tablosunu parse et
    const doc   = this._parse(html);
    const rows  = doc.querySelectorAll("table.chapter-list tbody tr, .chapters li");
    const chapters = [];

    Array.from(rows).forEach((row, i) => {
      const linkEl = row.querySelector("a[href*='/chapter/']");
      if (!linkEl) return;
      const url = this._url(linkEl.getAttribute("href") ?? "");
      if (!url) return;
      chapters.push({
        id:            String(i),
        title:         linkEl.textContent?.trim() ?? `Chapter ${i + 1}`,
        url,
        chapterNumber: i + 1,
      });
    });

    return chapters;
  },

  // ─── Chapter içeriği ──────────────────────────────────
  async getChapterContent(chapterUrl) {
    const res  = await fetch(chapterUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const doc  = this._parse(html);

    // RoyalRoad chapter content: div.chapter-inner.chapter-content
    const content = doc.querySelector(
      "div.chapter-inner.chapter-content, div.chapter-content, .chapter-inner"
    );

    if (!content) return "İçerik yüklenemedi.";

    // Reklam ve gereksiz elementleri kaldır
    content.querySelectorAll(
      "script, style, .ads, .adsbygoogle, [class*='ad-'], ins, .hidden"
    ).forEach((el) => el.remove());

    // Paragrafları al
    const paragraphs = Array.from(content.querySelectorAll("p"))
      .map((p) => p.textContent?.trim())
      .filter(Boolean);

    if (paragraphs.length > 0) return paragraphs.join("\n\n");

    return content.textContent?.trim() ?? "İçerik bulunamadı.";
  },
};
