// ═══════════════════════════════════════════════════════
//  LUMINA EXTENSION — Royal Road  v4.0.0
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

  _extractWindowVar(html, varName) {
    const lines = html.split("\n");
    for (const line of lines) {
      if (line.includes("window." + varName)) {
        const eqIdx = line.indexOf("=");
        if (eqIdx === -1) continue;
        const val = line.slice(eqIdx + 1).trim().replace(/;$/, "").trim();
        try { return JSON.parse(val); } catch { return null; }
      }
    }
    return null;
  },

  // Herhangi bir tarih formatını parse et
  _formatDate(val) {
    if (!val) return "";
    try {
      let date;
      if (typeof val === "number") {
        // Unix timestamp — saniye mi milisaniye mi?
        date = new Date(val > 1e10 ? val : val * 1000);
      } else if (typeof val === "string") {
        date = new Date(val);
      } else {
        return "";
      }
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch { return ""; }
  },

  _headers() {
    return { "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0" };
  },

  // ─── Novel listesi ────────────────────────────────────
  async getNovels(page) {
    page = page || 1;
    const res = await fetch(this.baseUrl + "/fictions/best-rated?page=" + page, { headers: this._headers() });
    const html = await res.text();
    const doc  = this._parse(html);

    return Array.from(doc.querySelectorAll(".fiction-list-item")).map((el) => {
      const titleEl = el.querySelector("h2.fiction-title a, .fiction-title a");
      const imgEl   = el.querySelector("img");
      const href    = titleEl ? titleEl.getAttribute("href") : "";
      const url     = this._url(href || "");

      // Yazar — çeşitli yerlerde olabilir
      let author = "";
      const authorCandidates = [
        el.querySelector(".author a"),
        el.querySelector(".author-name a"),
        el.querySelector("span.author a"),
        el.querySelector("[class*='author'] a"),
      ];
      for (const a of authorCandidates) {
        if (a && a.textContent.trim()) { author = a.textContent.trim(); break; }
      }

      // Kapak
      const coverUrl = (imgEl && (imgEl.getAttribute("data-src") || imgEl.getAttribute("src"))) || "";

      return { id: url, title: (titleEl ? titleEl.textContent.trim() : ""), url, coverUrl, author, status: "Ongoing" };
    }).filter(function(n) { return n.url && n.title; });
  },

  // ─── Arama ────────────────────────────────────────────
  async searchNovels(query, page) {
    page = page || 1;
    const q   = encodeURIComponent(query);
    const res = await fetch(this.baseUrl + "/fictions/search?title=" + q + "&page=" + page, { headers: this._headers() });
    const html = await res.text();
    const doc  = this._parse(html);

    return Array.from(doc.querySelectorAll(".fiction-list-item")).map((el) => {
      const titleEl = el.querySelector("h2.fiction-title a, .fiction-title a");
      const imgEl   = el.querySelector("img");
      const href    = titleEl ? titleEl.getAttribute("href") : "";
      const url     = this._url(href || "");

      let author = "";
      const authorCandidates = [
        el.querySelector(".author a"),
        el.querySelector(".author-name a"),
        el.querySelector("[class*='author'] a"),
      ];
      for (const a of authorCandidates) {
        if (a && a.textContent.trim()) { author = a.textContent.trim(); break; }
      }

      const coverUrl = (imgEl && (imgEl.getAttribute("data-src") || imgEl.getAttribute("src"))) || "";
      return { id: url, title: (titleEl ? titleEl.textContent.trim() : ""), url, coverUrl, author, status: "Ongoing" };
    }).filter(function(n) { return n.url && n.title; });
  },

  // ─── Novel detayı ─────────────────────────────────────
  async getNovelDetail(novelUrl) {
    const res  = await fetch(novelUrl, { headers: this._headers() });
    const html = await res.text();
    const doc  = this._parse(html);

    const coverUrl = this._extractWindowVar(html, "fictionCover") || "";

    // Synopsis
    let synopsis = "";
    const synSelectors = [
      ".fiction-description .description-content",
      ".description .fiction-description",
      ".fiction .description p",
      "[class*='description'] p",
    ];
    for (const sel of synSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.textContent.trim()) { synopsis = el.textContent.trim(); break; }
    }

    // Yazar
    let author = "";
    const authorSelectors = [
      "h4.font-white a",
      ".fic-title h4 a",
      "div.fic-title a[href*='/profile/']",
      "span[property='author'] a",
      "[itemprop='author'] a",
      ".author-name a",
      "h4 a[href*='/profile']",
    ];
    for (const sel of authorSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.textContent.trim()) { author = el.textContent.trim(); break; }
    }

    // Yayın tarihi — time elementinden
    let publishDate = "";
    const timeEls = doc.querySelectorAll("time");
    for (const t of Array.from(timeEls)) {
      const unix = t.getAttribute("unixtime") || t.getAttribute("data-time");
      if (unix) { publishDate = this._formatDate(Number(unix)); break; }
      const dt = t.getAttribute("datetime");
      if (dt) { publishDate = this._formatDate(dt); break; }
    }

    const statusEl = doc.querySelector(".label.label-sm, .fiction-status");
    const status   = statusEl && statusEl.textContent.toLowerCase().includes("ongoing") ? "Ongoing" : "Completed";

    // Rating — aria-label="Rating: X.XX out of 5"
    let rating = "";
    const ratingEl = doc.querySelector("[aria-label*='Rating']");
    if (ratingEl) {
      const match = (ratingEl.getAttribute("aria-label") || "").match(/[\d.]+/);
      if (match) rating = parseFloat(match[0]).toFixed(1);
    }

    // Genres — span.tags a.fiction-tag
    const genres = Array.from(doc.querySelectorAll("span.tags a.fiction-tag"))
      .map(function(a) { return a.textContent.trim(); })
      .filter(Boolean);

    return { coverUrl, synopsis, author, publishDate, status, genres, rating };
  },

  // ─── Chapter listesi ──────────────────────────────────
  async getChapters(novelUrl) {
    const res  = await fetch(novelUrl, { headers: this._headers() });
    const html = await res.text();

    const chaptersData = this._extractWindowVar(html, "chapters");

    if (chaptersData && Array.isArray(chaptersData) && chaptersData.length > 0) {
      const self = this;
      return chaptersData.map(function(ch, i) {
        // RoyalRoad date field adları: date, releaseDate, created
        const dateVal = ch.date || ch.releaseDate || ch.created || null;
        return {
          id:            String(ch.id || i),
          title:         ch.title || ("Chapter " + (i + 1)),
          url:           self._url(ch.url || ""),
          chapterNumber: i + 1,
          date:          self._formatDate(dateVal),
        };
      }).filter(function(ch) { return ch.url; });
    }

    // Fallback HTML
    const doc  = this._parse(html);
    const rows = doc.querySelectorAll("table.chapter-list tbody tr");
    const self = this;
    return Array.from(rows).map(function(row, i) {
      const link = row.querySelector("a[href*='/chapter/']");
      const time = row.querySelector("time");
      if (!link) return null;
      const url = self._url(link.getAttribute("href") || "");
      if (!url) return null;
      const dateAttr = time ? (time.getAttribute("datetime") || time.getAttribute("unixtime") || time.textContent.trim()) : "";
      return {
        id: String(i), title: link.textContent.trim() || ("Chapter " + (i+1)),
        url, chapterNumber: i + 1, date: self._formatDate(dateAttr),
      };
    }).filter(Boolean);
  },

  // ─── Chapter içeriği ──────────────────────────────────
  async getChapterContent(chapterUrl) {
    const res  = await fetch(chapterUrl, { headers: this._headers() });
    const html = await res.text();
    const doc  = this._parse(html);

    const content = doc.querySelector("div.chapter-inner.chapter-content, .chapter-content, .chapter-inner");
    if (!content) return "İçerik yüklenemedi.";

    content.querySelectorAll("script, style, .ads, .adsbygoogle, [class*='ad-'], ins, .hidden, .author-note-portlet").forEach(function(el) { el.remove(); });

    const paragraphs = Array.from(content.querySelectorAll("p"))
      .map(function(p) { return p.textContent.trim(); })
      .filter(Boolean);

    if (paragraphs.length > 0) return paragraphs.join("\n\n");
    return content.textContent.trim() || "İçerik bulunamadı.";
  },
};
