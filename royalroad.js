// ═══════════════════════════════════════════════════════
//  LUMINA EXTENSION — Royal Road
//  Site: https://www.royalroad.com
//  Version: 3.0.0
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

  // HTML'den window.X = ... değişkenini çek
  _extractWindowVar(html, varName) {
    const lines = html.split("\n");
    for (const line of lines) {
      if (line.includes(`window.${varName}`)) {
        const eqIdx = line.indexOf("=");
        if (eqIdx === -1) continue;
        let val = line.slice(eqIdx + 1).trim().replace(/;$/, "").trim();
        try { return JSON.parse(val); } catch { return null; }
      }
    }
    return null;
  },

  // Unix timestamp → okunabilir tarih
  _formatDate(ts) {
    if (!ts) return "";
    // RoyalRoad bazen ms, bazen saniye verir
    const ms = ts > 1e10 ? ts : ts * 1000;
    return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  },

  // ─── Novel listesi ────────────────────────────────────
  async getNovels(page = 1) {
    const res = await fetch(
      `${this.baseUrl}/fictions/best-rated?page=${page}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36" } }
    );
    const html = await res.text();
    const doc  = this._parse(html);

    return Array.from(doc.querySelectorAll(".fiction-list-item")).map((el) => {
      const titleEl  = el.querySelector("h2.fiction-title a, .fiction-title a");
      const imgEl    = el.querySelector("img.lazyload, img[data-src], img");
      // Yazar: ".author a" veya ".author-name a"
      const authorEl = el.querySelector(".author a, .author-name a, span.author a");
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
    const q   = encodeURIComponent(query);
    const res = await fetch(
      `${this.baseUrl}/fictions/search?title=${q}&page=${page}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36" } }
    );
    const html = await res.text();
    const doc  = this._parse(html);

    return Array.from(doc.querySelectorAll(".fiction-list-item")).map((el) => {
      const titleEl  = el.querySelector("h2.fiction-title a, .fiction-title a");
      const imgEl    = el.querySelector("img.lazyload, img[data-src], img");
      const authorEl = el.querySelector(".author a, .author-name a, span.author a");
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
    const res  = await fetch(novelUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36" }
    });
    const html = await res.text();
    const doc  = this._parse(html);

    // Kapak — window.fictionCover
    const coverUrl = this._extractWindowVar(html, "fictionCover") ?? "";

    // Synopsis — .fiction-description p veya .description
    const synopsisEl = doc.querySelector(
      ".fiction-description .description-content, .fiction .description, .fic-description p"
    );
    const synopsis = synopsisEl?.textContent?.trim() ?? "";

    // Yazar — çeşitli selector'lar dene
    let author = "";
    const authorSelectors = [
      "h4.font-white a",
      ".fic-title h4 a",
      "div.fic-title div:last-child a",
      "span[property='author'] a",
      "[itemprop='author'] [itemprop='name']",
      ".author-name a",
    ];
    for (const sel of authorSelectors) {
      const el = doc.querySelector(sel);
      if (el?.textContent?.trim()) { author = el.textContent.trim(); break; }
    }

    // Yayınlanma tarihi
    let publishDate = "";
    const timeEl = doc.querySelector("time[unixtime], time[datetime], .date-posted time");
    if (timeEl) {
      const unix = timeEl.getAttribute("unixtime") ?? timeEl.getAttribute("data-time");
      publishDate = unix ? this._formatDate(Number(unix)) : (timeEl.textContent?.trim() ?? "");
    }

    // Status
    const statusEl = doc.querySelector(".label.label-sm, .fiction-status, span.label-sm");
    const status   = statusEl?.textContent?.trim().toLowerCase().includes("ongoing") ? "Ongoing" : "Completed";

    return { coverUrl, synopsis, author, publishDate, status };
  },

  // ─── Chapter listesi — window.chapters'dan ────────────
  async getChapters(novelUrl) {
    const res  = await fetch(novelUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36" }
    });
    const html = await res.text();

    const chaptersData = this._extractWindowVar(html, "chapters");

    if (chaptersData && Array.isArray(chaptersData) && chaptersData.length > 0) {
      return chaptersData.map((ch, i) => ({
        id:            String(ch.id ?? i),
        title:         ch.title ?? `Chapter ${i + 1}`,
        url:           this._url(ch.url ?? ""),
        chapterNumber: i + 1,
        // date alanı Unix timestamp (saniye)
        date:          ch.date ? this._formatDate(ch.date) : "",
      })).filter((ch) => ch.url);
    }

    // Fallback: HTML chapter tablosu
    const doc  = this._parse(html);
    const rows = doc.querySelectorAll("table.chapter-list tbody tr, .chapters li");
    return Array.from(rows).map((row, i) => {
      const linkEl = row.querySelector("a[href*='/chapter/']");
      const timeEl = row.querySelector("time");
      if (!linkEl) return null;
      const url = this._url(linkEl.getAttribute("href") ?? "");
      if (!url) return null;
      return {
        id:            String(i),
        title:         linkEl.textContent?.trim() ?? `Chapter ${i + 1}`,
        url,
        chapterNumber: i + 1,
        date:          timeEl?.getAttribute("title") ?? timeEl?.textContent?.trim() ?? "",
      };
    }).filter(Boolean);
  },

  // ─── Chapter içeriği ──────────────────────────────────
  async getChapterContent(chapterUrl) {
    const res  = await fetch(chapterUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36" }
    });
    const html = await res.text();
    const doc  = this._parse(html);

    const content = doc.querySelector(
      "div.chapter-inner.chapter-content, div.chapter-content, .chapter-inner"
    );
    if (!content) return "İçerik yüklenemedi.";

    content.querySelectorAll(
      "script, style, .ads, .adsbygoogle, [class*='ad-'], ins, .hidden, .author-note-portlet"
    ).forEach((el) => el.remove());

    const paragraphs = Array.from(content.querySelectorAll("p"))
      .map((p) => p.textContent?.trim())
      .filter(Boolean);

    if (paragraphs.length > 0) return paragraphs.join("\n\n");
    return content.textContent?.trim() ?? "İçerik bulunamadı.";
  },
};
