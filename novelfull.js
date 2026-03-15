// ═══════════════════════════════════════════════════════
//  LUMINA EXTENSION — NovelFull
//  Site: https://novelfull.net
//  Version: 1.0.0
// ═══════════════════════════════════════════════════════

export default {
  id: "novelfull",
  name: "NovelFull",
  baseUrl: "https://novelfull.net",

  // HTML parse yardımcısı
  _parse(html) {
    return new DOMParser().parseFromString(html, "text/html");
  },

  // Göreceli URL'i tam URL'e çevir
  _url(path) {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return this.baseUrl + (path.startsWith("/") ? path : "/" + path);
  },

  // ─── Novel listesi ────────────────────────────────────
  async getNovels(page = 1) {
    const res = await fetch(`${this.baseUrl}/most-popular?page=${page}`);
    const html = await res.text();
    const doc = this._parse(html);

    return Array.from(doc.querySelectorAll(".truyen-list .row")).map((el) => {
      const titleEl = el.querySelector(".truyen-title a");
      const imgEl   = el.querySelector("img");
      const authorEl = el.querySelector(".author");

      const url = this._url(titleEl?.getAttribute("href") ?? "");
      return {
        id:       url,
        title:    titleEl?.textContent?.trim() ?? "Unknown",
        url,
        coverUrl: this._url(imgEl?.getAttribute("src") ?? ""),
        author:   authorEl?.textContent?.trim(),
        status:   "Unknown",
      };
    }).filter((n) => n.url);
  },

  // ─── Arama ────────────────────────────────────────────
  async searchNovels(query, page = 1) {
    const q = encodeURIComponent(query.toLowerCase().replace(/ /g, "+"));
    const res = await fetch(`${this.baseUrl}/search?keyword=${q}&page=${page}`);
    const html = await res.text();
    const doc = this._parse(html);

    return Array.from(doc.querySelectorAll(".truyen-list .row")).map((el) => {
      const titleEl = el.querySelector(".truyen-title a");
      const imgEl   = el.querySelector("img");
      const url = this._url(titleEl?.getAttribute("href") ?? "");
      return {
        id:       url,
        title:    titleEl?.textContent?.trim() ?? "Unknown",
        url,
        coverUrl: this._url(imgEl?.getAttribute("src") ?? ""),
      };
    }).filter((n) => n.url);
  },

  // ─── Novel detayı (synopsis, status) ─────────────────
  async getNovelDetail(novelUrl) {
    const res = await fetch(novelUrl);
    const html = await res.text();
    const doc = this._parse(html);

    const synopsisEl = doc.querySelector(".desc-text");
    const statusEl   = doc.querySelector(".info .text-primary");
    const coverEl    = doc.querySelector(".books img");
    const authorEl   = doc.querySelector(".info a[href*='author']");

    return {
      synopsis:      synopsisEl?.textContent?.trim(),
      status:        statusEl?.textContent?.trim() === "Ongoing" ? "Ongoing" : "Completed",
      coverUrl:      this._url(coverEl?.getAttribute("src") ?? ""),
      author:        authorEl?.textContent?.trim(),
    };
  },

  // ─── Chapter listesi ──────────────────────────────────
  async getChapters(novelUrl) {
    // NovelFull chapter listesi pagination'lı — tüm sayfaları çek
    const chapters = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(`${novelUrl}?page=${page}`);
      const html = await res.text();
      const doc = this._parse(html);

      const items = doc.querySelectorAll(".list-chapter li a");
      if (items.length === 0) { hasMore = false; break; }

      Array.from(items).forEach((a, i) => {
        const url = this._url(a.getAttribute("href") ?? "");
        if (url) {
          chapters.push({
            id:            url,
            title:         a.textContent?.trim() ?? `Chapter ${chapters.length + 1}`,
            url,
            chapterNumber: chapters.length + 1,
          });
        }
      });

      // Sonraki sayfa var mı?
      const nextBtn = doc.querySelector(".pagination .next a");
      if (nextBtn) {
        page++;
        // Çok fazla sayfa çekmemek için limit koy
        if (page > 50) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    return chapters;
  },

  // ─── Chapter içeriği ──────────────────────────────────
  async getChapterContent(chapterUrl) {
    const res = await fetch(chapterUrl);
    const html = await res.text();
    const doc = this._parse(html);

    // İçerik container
    const content = doc.querySelector("#chapter-content");
    if (!content) return "İçerik yüklenemedi.";

    // Gereksiz elementleri temizle
    content.querySelectorAll("script, .ads, .adsbygoogle, [class*='ad-'], ins").forEach((el) => el.remove());

    // Paragrafları al
    const paragraphs = content.querySelectorAll("p");
    if (paragraphs.length > 0) {
      return Array.from(paragraphs)
        .map((p) => p.textContent?.trim())
        .filter(Boolean)
        .join("\n\n");
    }

    // Paragraf yoksa direkt text
    return content.textContent?.trim() ?? "İçerik bulunamadı.";
  },
};
