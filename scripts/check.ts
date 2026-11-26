import { Glob } from "bun";
import { dirname, join, normalize } from "node:path";

export type Problem = { page: string; message: string };

export type Page = {
  refs: string[];
  hasTitle: boolean;
  hasLang: boolean;
  imagesWithoutAlt: number;
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function readPage(html: string): Promise<Page> {
  const page: Page = { refs: [], hasTitle: false, hasLang: false, imagesWithoutAlt: 0 };
  await new HTMLRewriter()
    .on("a[href], link[href]", { element: (el) => void page.refs.push(el.getAttribute("href")!) })
    .on("img[src], script[src], iframe[src], source[src]", { element: (el) => void page.refs.push(el.getAttribute("src")!) })
    .on("img", { element: (el) => void (!el.hasAttribute("alt") && page.imagesWithoutAlt++) })
    .on("html[lang]", { element: () => void (page.hasLang = true) })
    .on("title", { text: (t) => void (t.text.trim() && (page.hasTitle = true)) })
    .transform(new Response(html))
    .text();
  return page;
}

export function isLocal(ref: string): boolean {
  return !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);
}

export function resolveRef(pagePath: string, ref: string): string {
  const clean = ref.split(/[?#]/)[0]!;
  const target = normalize(join(dirname(pagePath), clean));
  return clean === "" || clean.endsWith("/") || clean === "." || clean === ".." ? join(target, "index.html") : target;
}

export async function checkSite(root: string): Promise<Problem[]> {
  const problems: Problem[] = [];
  for await (const path of new Glob("**/*").scan({ cwd: root, onlyFiles: true })) {
    if (Bun.file(join(root, path)).size > MAX_FILE_BYTES) {
      problems.push({ page: path, message: "file is larger than 25 MB, shrink it before committing" });
    }
  }
  for await (const path of new Glob("**/*.html").scan({ cwd: root })) {
    const page = await readPage(await Bun.file(join(root, path)).text());
    if (!page.hasTitle) problems.push({ page: path, message: "missing <title>" });
    if (!page.hasLang) problems.push({ page: path, message: 'missing <html lang="...">' });
    if (page.imagesWithoutAlt) problems.push({ page: path, message: `${page.imagesWithoutAlt} image(s) missing alt text` });
    for (const ref of page.refs.filter(isLocal)) {
      if (ref.startsWith("/")) {
        problems.push({ page: path, message: `"${ref}" starts with "/", use a relative link instead` });
        continue;
      }
      const target = resolveRef(path, ref);
      if (target.startsWith("..") || !(await Bun.file(join(root, target)).exists())) {
        problems.push({ page: path, message: `broken link "${ref}"` });
      }
    }
  }
  return problems;
}

if (import.meta.main) {
  const root = Bun.argv[2] ?? "site";
  const problems = await checkSite(root);
  for (const p of problems) console.error(`✗ ${p.page}: ${p.message}`);
  console.log(problems.length ? `\n${problems.length} problem(s) found` : `✓ ${root} looks good`);
  process.exit(problems.length ? 1 : 0);
}
