import { join, normalize } from "node:path";

const root = Bun.argv[2] ?? "site";
const port = Number(Bun.env.PORT ?? 8000);

Bun.serve({
  port,
  async fetch(req) {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = Bun.file(join(root, normalize(path)));
    return (await file.exists()) ? new Response(file) : new Response("not found", { status: 404 });
  },
});

console.log(`previewing ${root} at http://localhost:${port}`);
