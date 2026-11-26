# danielfreder.com

Dan Freder's portfolio. Plain HTML and CSS: no framework, no build step, nothing to install to edit it.

Every push to `main` is checked automatically (broken links, missing images, missing alt text). If the check passes, the site goes live on GitHub Pages about a minute later. If it fails, nothing changes on the live site and GitHub emails you what broke.

## What's where

```
site/                  everything in here is the website
  index.html           home page: the list of works
  about.html           bio and contact
  work/*.html          one page per piece
  images/<piece>/      photos for each piece
  style.css            the look of the whole site
  classic/             a copy of the old Weebly site, kept for reference
  favicon.svg          the little "df" icon in the browser tab
scripts/check.ts       the link checker CI runs
.github/workflows/     the check-then-deploy pipeline
```

The old Weebly addresses (`/photo--video.html`, `/bio--contact.html`, …) redirect to the new pages, so old links people have shared still work.

## Editing

**Small text fixes:** open the file on github.com, click the pencil icon, edit, then "Commit changes". That's it, it deploys itself.

**Adding a new piece:**

1. Put its photos in a new folder, e.g. `site/images/new-thing/`. Keep each photo under ~2 MB (2000 px on the long side is plenty).
2. Copy an existing page in `site/work/` that looks similar (e.g. `pax.html` for photos, `beamscriber.html` for a video) and save it as `site/work/new-thing.html`.
3. Change the title, year, text, photos and YouTube ID in the copy.
   - A YouTube ID is the part after `v=` in a YouTube link: `youtube.com/watch?v=`**`z1W_Oqdq9jc`**
   - `<div class="grid">` lays photos out as a grid; `<div class="stack">` stacks them full width.
4. Add one line for it to the list in `site/index.html`:
   ```html
   <li><a href="work/new-thing.html"><span class="title">new thing</span><span class="year">2026</span></a></li>
   ```
5. Commit and push.

Links between pages must be relative (`work/pax.html`, `../images/...`), never starting with `/`. The checker will tell you if one slips through.

## Previewing on your computer

Needs [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`).

```sh
bun run dev      # preview at http://localhost:8000
bun run check    # run the same link check CI runs
bun test         # test the checker itself
```

## Hosting and domain

Hosting is GitHub Pages (free). The pipeline is `.github/workflows/deploy.yml`: `check` runs on every push and pull request, and `deploy` runs only when `check` passes on `main`.

**One-time setup to point danielfreder.com at it:**

1. In the repo: Settings → Pages → Source: **GitHub Actions**.
2. Settings → Pages → Custom domain: `danielfreder.com`, save, then tick **Enforce HTTPS** once it becomes available.
3. At the domain registrar, replace the old Weebly DNS records with:

   | Type  | Name | Value                  |
   |-------|------|------------------------|
   | A     | @    | 185.199.108.153        |
   | A     | @    | 185.199.109.153        |
   | A     | @    | 185.199.110.153        |
   | A     | @    | 185.199.111.153        |
   | AAAA  | @    | 2606:50c0:8000::153    |
   | AAAA  | @    | 2606:50c0:8001::153    |
   | AAAA  | @    | 2606:50c0:8002::153    |
   | AAAA  | @    | 2606:50c0:8003::153    |
   | CNAME | www  | `<github-username>.github.io` |

4. Optional but recommended: verify the domain under your GitHub account (Settings → Pages → Verified domains), so nobody else can claim it on GitHub.

DNS changes can take up to a day. Once the new site loads on danielfreder.com, the Weebly plan can be cancelled.

The `github.io` address keeps working behind the scenes and redirects to danielfreder.com.

## The classic copy

The minimal site lives at the root and the classic copy at `/classic/`. To delete the classic copy, remove `site/classic/` and the "classic site" line in `site/about.html`.
