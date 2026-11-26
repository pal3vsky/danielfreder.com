import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSite, isLocal, readPage, resolveRef } from "../../scripts/check";

const page = (body: string, head = "<title>t</title>") =>
  `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`;

describe("check.ts", () => {
  describe("readPage", () => {
    it("collects links, images, stylesheets and embeds", async () => {
      const result = await readPage(
        page('<a href="a.html">a</a><img src="b.jpg" alt="b"><iframe src="https://x.test"></iframe>', '<title>t</title><link rel="stylesheet" href="s.css">'),
      );
      expect(result.refs).toEqual(["s.css", "a.html", "b.jpg", "https://x.test"]);
    });

    it("reports title and lang when present", async () => {
      const result = await readPage(page(""));
      expect(result.hasTitle).toBe(true);
      expect(result.hasLang).toBe(true);
    });

    it("reports a blank title and missing lang", async () => {
      const result = await readPage("<html><head><title> </title></head></html>");
      expect(result.hasTitle).toBe(false);
      expect(result.hasLang).toBe(false);
    });

    it("counts images without alt text", async () => {
      const result = await readPage(page('<img src="a.jpg"><img src="b.jpg" alt="">'));
      expect(result.imagesWithoutAlt).toBe(1);
    });
  });

  describe("isLocal", () => {
    it("treats relative paths as local", () => {
      expect(isLocal("work/pax.html")).toBe(true);
      expect(isLocal("../style.css")).toBe(true);
      expect(isLocal("/root.html")).toBe(true);
    });

    it("treats urls, protocol-relative links and anchors as external", () => {
      expect(isLocal("https://x.test")).toBe(false);
      expect(isLocal("mailto:a@b.c")).toBe(false);
      expect(isLocal("//cdn.test/a.js")).toBe(false);
      expect(isLocal("#top")).toBe(false);
    });
  });

  describe("resolveRef", () => {
    it("resolves relative to the page's folder", () => {
      expect(resolveRef("work/pax.html", "../images/a.jpg")).toBe("images/a.jpg");
    });

    it("maps folder links to index.html", () => {
      expect(resolveRef("work/pax.html", "../")).toBe("index.html");
      expect(resolveRef("about.html", "./")).toBe("index.html");
      expect(resolveRef("about.html", "classic/")).toBe("classic/index.html");
      expect(resolveRef("classic/web.html", "..")).toBe("index.html");
    });

    it("ignores query strings and fragments", () => {
      expect(resolveRef("index.html", "a.html?x=1#y")).toBe("a.html");
    });
  });

  describe("checkSite", () => {
    let root: string;

    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), "check-"));
    });

    afterEach(async () => {
      await rm(root, { recursive: true, force: true });
    });

    it("passes a site whose links all resolve", async () => {
      await Bun.write(join(root, "index.html"), page('<a href="work/a.html">a</a><a href="https://x.test">x</a>'));
      await Bun.write(join(root, "work/a.html"), page('<a href="../">home</a><img src="../img/a.jpg" alt="a">'));
      await Bun.write(join(root, "img/a.jpg"), "jpg");
      expect(await checkSite(root)).toEqual([]);
    });

    it("reports broken links and images", async () => {
      await Bun.write(join(root, "index.html"), page('<a href="missing.html">x</a><img src="gone.jpg" alt="g">'));
      expect(await checkSite(root)).toEqual([
        { page: "index.html", message: 'broken link "missing.html"' },
        { page: "index.html", message: 'broken link "gone.jpg"' },
      ]);
    });

    it("reports links that escape the site folder", async () => {
      await Bun.write(join(root, "index.html"), page('<a href="../outside.html">x</a>'));
      expect(await checkSite(root)).toEqual([{ page: "index.html", message: 'broken link "../outside.html"' }]);
    });

    it("reports root-absolute links", async () => {
      await Bun.write(join(root, "index.html"), page('<a href="/index.html">x</a>'));
      expect(await checkSite(root)).toEqual([
        { page: "index.html", message: '"/index.html" starts with "/", use a relative link instead' },
      ]);
    });

    it("reports missing title, lang and alt text", async () => {
      await Bun.write(join(root, "index.html"), '<html><body><img src="a.jpg"></body></html>');
      await Bun.write(join(root, "a.jpg"), "jpg");
      expect(await checkSite(root)).toEqual([
        { page: "index.html", message: "missing <title>" },
        { page: "index.html", message: 'missing <html lang="...">' },
        { page: "index.html", message: "1 image(s) missing alt text" },
      ]);
    });

    it("reports files over 25 MB", async () => {
      await Bun.write(join(root, "index.html"), page(""));
      await Bun.write(join(root, "huge.mov"), new Uint8Array(25 * 1024 * 1024 + 1));
      expect(await checkSite(root)).toEqual([
        { page: "huge.mov", message: "file is larger than 25 MB, shrink it before committing" },
      ]);
    });

    it("passes the real site", async () => {
      expect(await checkSite(join(import.meta.dir, "../../site"))).toEqual([]);
    });
  });
});
