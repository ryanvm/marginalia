# Blog starter handoff — Eleventy 3 + GitHub Pages

A static blog with **zero runtime dependencies, zero client-side JS, zero hosting cost**.
Modeled on the stack behind `gruhn.me` ([source](https://github.com/gruhn/gruhn.me)), with the
improvements listed at the bottom folded in.

---

## 1. Architecture

| Concern | Choice |
| --- | --- |
| Site generator | Eleventy (11ty) v3, ESM config |
| Templating | Nunjucks (`.njk`) for layouts, Markdown for posts |
| Feed | `@11ty/eleventy-plugin-rss` → `/feed.xml` |
| Markdown extras | `markdown-it-footnote` |
| Styling | Hand-written CSS, one file, content-hashed URL |
| Build | GitHub Actions on push to `main` |
| Hosting | GitHub Pages (Actions deployment, not branch deployment) |
| TLS / CDN | GitHub's, free, automatic |
| Client JS | None. This is a design constraint, not an oversight. |

Build is `npm ci && npx eleventy` → `_site/` → uploaded as a Pages artifact → deployed. Nothing
executes at request time.

---

## 2. Repo layout

```
.
├── .github/workflows/pages.yml
├── .nvmrc
├── .gitignore
├── .editorconfig
├── CLAUDE.md
├── README.md
├── eleventy.config.js
├── site.config.js              # single source of site metadata
├── package.json
└── src
    ├── _data
    │   ├── site.js             # re-export of site.config.js
    │   └── eleventyComputed.js # draft handling
    ├── _includes
    │   ├── base.njk
    │   └── post.njk
    ├── blog
    │   ├── blog.json           # directory data: layout + tag for all posts
    │   └── my-first-post
    │       ├── index.md
    │       └── diagram.svg     # images live next to the post that uses them
    ├── static                  # copied to output root: /style.css, /robots.txt, ...
    │   ├── style.css
    │   └── robots.txt
    ├── index.njk               # post index
    ├── sitemap.njk
    └── 404.md
```

**Why directory-per-post:** `src/blog/my-first-post/index.md` produces `/blog/my-first-post/` with
no permalink config, and images sit beside the prose that references them. Deleting a post deletes
its assets. Renaming is one `git mv`.

---

## 3. Files

### `package.json`

```json
{
  "name": "blog",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "eleventy",
    "start": "eleventy --serve --incremental"
  },
  "devDependencies": {
    "@11ty/eleventy": "^3.1.6",
    "@11ty/eleventy-plugin-rss": "^3.0.0",
    "markdown-it-footnote": "^4.0.0"
  }
}
```

Three dev dependencies. Resist adding a fourth without a reason you'd defend in review.

### `site.config.js`

```js
export default {
  title: "Your Name",
  subtitle: "Notes on software, mostly.",
  description: "Essays and notes on software architecture, systems, and physics.",
  // No trailing slash. Used to build absolute URLs for OG tags, sitemap, feed.
  url: "https://example.com",
  author: { name: "Your Name", email: "you@example.com" },
  language: "en",
  socials: [
    { name: "GitHub", url: "https://github.com/yourhandle" },
    { name: "LinkedIn", url: "https://www.linkedin.com/in/yourhandle/" },
  ],
};
```

### `src/_data/site.js`

```js
export { default } from "../../site.config.js";
```

One definition of the site metadata, visible to both the Eleventy config and every template.

### `eleventy.config.js`

```js
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";
import markdownItFootnote from "markdown-it-footnote";
import site from "./site.config.js";

const readableDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(feedPlugin, {
    type: "rss",
    outputPath: "/feed.xml",
    collection: { name: "post", limit: 0 },
    metadata: {
      title: site.title,
      subtitle: site.subtitle,
      language: site.language,
      base: `${site.url}/`,
      author: { name: site.author.name },
    },
  });

  eleventyConfig.amendLibrary("md", (md) => md.use(markdownItFootnote));

  // src/static/* lands at the output root: /style.css, /robots.txt, /rss.svg ...
  eleventyConfig.addPassthroughCopy({ "src/static": "." });

  // Images co-located with posts keep their relative paths.
  eleventyConfig.addPassthroughCopy("src/blog/**/*.{png,jpg,jpeg,gif,svg,webp,avif}");

  // Cache busting without a hand-maintained ?version=N counter.
  // Global data *functions* re-run on every build, so --serve stays correct.
  eleventyConfig.addGlobalData("cssHash", () =>
    createHash("sha256")
      .update(readFileSync("src/static/style.css"))
      .digest("hex")
      .slice(0, 8),
  );
  eleventyConfig.addWatchTarget("src/static/style.css");

  eleventyConfig.addFilter("readableDate", (date) => readableDate.format(date));
  eleventyConfig.addFilter("isoDate", (date) => date.toISOString().slice(0, 10));
  eleventyConfig.addFilter("absolute", (path) => new URL(path, `${site.url}/`).href);

  return {
    dir: { input: "src", output: "_site", includes: "_includes" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
```

### `src/_data/eleventyComputed.js`

```js
// Drafts render locally (`npm start`) and vanish from production builds.
const isProdBuild = () => process.env.ELEVENTY_RUN_MODE === "build";

export default {
  eleventyExcludeFromCollections: (data) =>
    data.draft && isProdBuild() ? true : data.eleventyExcludeFromCollections,
  permalink: (data) => (data.draft && isProdBuild() ? false : data.permalink),
};
```

### `src/blog/blog.json`

```json
{
  "layout": "post.njk",
  "tags": ["post"]
}
```

Directory data — every post inherits it. No per-file boilerplate beyond title and date.

### `src/_includes/base.njk`

```njk
<!DOCTYPE html>
<html lang="{{ site.language }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% if title %}{{ title }} — {{ site.title }}{% else %}{{ site.title }}{% endif %}</title>

  <link rel="stylesheet" href="/style.css?v={{ cssHash }}">
  <link rel="alternate" type="application/rss+xml" title="{{ site.title }}" href="/feed.xml">
  <link rel="canonical" href="{{ page.url | absolute }}">

  <meta name="description" content="{{ description or site.description }}">
  <meta property="og:type" content="{% if layout == 'post.njk' %}article{% else %}website{% endif %}">
  <meta property="og:title" content="{{ title or site.title }}">
  <meta property="og:description" content="{{ description or site.description }}">
  <meta property="og:url" content="{{ page.url | absolute }}">
  <meta property="og:site_name" content="{{ site.title }}">
  <meta name="twitter:card" content="summary">

  {%- if styles %}
  <style>{{ styles | safe }}</style>
  {%- endif %}
</head>
<body>
  <main>
    <header>
      <a href="/" class="author">{{ site.title }} / Blog</a>
      <nav class="socials">
        <a href="/feed.xml">RSS</a>
        {%- for social in site.socials %}
        <a href="{{ social.url }}" rel="me">{{ social.name }}</a>
        {%- endfor %}
      </nav>
    </header>

    {{ content | safe }}
  </main>
</body>
</html>
```

### `src/_includes/post.njk`

```njk
---
layout: base.njk
---
<article>
  <h1>{{ title }}</h1>
  <time datetime="{{ page.date | isoDate }}">{{ page.date | readableDate }}</time>
  {% if draft %}<p class="draft-banner">Draft — not published.</p>{% endif %}

  {{ content | safe }}
</article>
```

### `src/index.njk`

```njk
---
layout: base.njk
---
<ul class="post-list">
{%- for post in collections.post | reverse %}
  <li>
    <time datetime="{{ post.date | isoDate }}">{{ post.date | readableDate }}</time>
    <a href="{{ post.url }}">{{ post.data.title }}</a>
  </li>
{%- endfor %}
</ul>
```

### `src/sitemap.njk`

```njk
---
permalink: /sitemap.xml
eleventyExcludeFromCollections: true
---
<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{%- for item in collections.all %}
  <url>
    <loc>{{ item.url | absolute }}</loc>
    <lastmod>{{ item.date | isoDate }}</lastmod>
  </url>
{%- endfor %}
</urlset>
```

### `src/404.md`

```markdown
---
layout: base.njk
title: Not found
permalink: /404.html
eleventyExcludeFromCollections: true
---

Nothing here. [Back to the index](/).
```

### `src/static/robots.txt`

```
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

### `src/static/style.css`

```css
:root {
  --bg: #fdfdfc;
  --fg: #1a1a1a;
  --muted: #6b6b6b;
  --accent: #14568b;
  --rule: #e2e2df;
  --measure: 34rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16171a;
    --fg: #e6e6e3;
    --muted: #9a9a95;
    --accent: #7fb4e8;
    --rule: #2c2e33;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 1.05rem/1.65 ui-serif, Georgia, "Times New Roman", serif;
  -webkit-text-size-adjust: 100%;
}

main {
  max-width: var(--measure);
  margin: 0 auto;
  padding: 2.5rem 1.25rem 6rem;
}

header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--rule);
  margin-bottom: 2.5rem;
}

.author { font-weight: 600; text-decoration: none; color: var(--fg); }
.socials { display: flex; gap: 0.85rem; font-size: 0.85rem; }

a { color: var(--accent); text-underline-offset: 0.15em; }

h1, h2, h3 {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.25;
  margin-top: 2.25rem;
}
h1 { font-size: 1.9rem; margin-bottom: 0.25rem; }

time { color: var(--muted); font-size: 0.85rem; }

img, svg, video { max-width: 100%; height: auto; }

figure { margin: 2rem 0; text-align: center; }
figcaption { color: var(--muted); font-size: 0.85rem; font-style: italic; }

blockquote {
  margin: 1.5rem 0;
  padding-left: 1rem;
  border-left: 3px solid var(--rule);
  color: var(--muted);
}

pre, code {
  font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Menlo, monospace;
  font-size: 0.88em;
}
pre {
  padding: 0.9rem 1rem;
  overflow-x: auto;
  border: 1px solid var(--rule);
  border-radius: 4px;
}

.post-list { list-style: none; padding: 0; }
.post-list li {
  display: flex;
  gap: 1rem;
  align-items: baseline;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--rule);
}
.post-list time { flex: 0 0 6.5rem; }

.draft-banner {
  background: #ffe9a8;
  color: #4a3a00;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.footnotes { font-size: 0.9rem; color: var(--muted); border-top: 1px solid var(--rule); margin-top: 3rem; }
```

### `.github/workflows/pages.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### `.nvmrc`

```
24
```

### `.gitignore`

```
node_modules/
_site/
.cache/
.DS_Store
```

### `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

---

## 4. First-time setup

1. `npm install`, then `npm start` → <http://localhost:8080>.
2. Push to `main`.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions.** Not "Deploy from a
   branch". If you skip this, the workflow succeeds and nothing is served.
4. **Settings → Pages → Custom domain** → enter your domain, then tick **Enforce HTTPS** once the
   cert provisions (can take ~15 min).
5. DNS at your registrar:
   - Apex (`example.com`): four `A` records → `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`; plus the matching `AAAA` records
     (`2606:50c0:8000::153`, `…8001::153`, `…8002::153`, `…8003::153`).
   - Or `www`: a single `CNAME` → `<user>.github.io`.
   - Verify GitHub's current IPs in their docs before committing — they have changed before.
6. Update `site.config.js` and `src/static/robots.txt` with the real domain.

**Gotcha:** with Actions-based deployment the custom domain lives in Pages settings, not in a
`CNAME` file. A `CNAME` at the repo root does nothing, because it never reaches `_site`. If you
want belt-and-braces, put the `CNAME` file in `src/static/` so it gets copied into the artifact.

---

## 5. Writing a post

```
src/blog/np-overrated/index.md
```

```markdown
---
title: NP-overrated
date: 2026-08-13
description: One sentence for search results and link previews.
draft: true
---

Body in Markdown. Footnotes work: like this[^1].

![Diagram](./diagram.svg)

[^1]: The footnote text.
```

- URL is derived from the directory name: `/blog/np-overrated/`.
- `draft: true` shows locally, disappears in production. Delete the line to publish.
- `description` feeds `<meta name="description">` and the OG tags. Write it; the default fallback
  is the site-wide blurb, which is useless per-post.
- Post images go in the post directory and are referenced relatively.

---

## 6. Deltas from the reference site, and why

| Change | Rationale |
| --- | --- |
| Content-hashed CSS (`?v={{ cssHash }}`) | The original hand-increments `?version=4`. That's a manual step that gets forgotten exactly when it matters. |
| `site.config.js` as single source of metadata | The original repeats the title/base URL in the config and templates. |
| OG / Twitter / canonical meta tags | The reference emits almost none, so shared links render bare. Costs eight lines, once. |
| Directory-per-post with co-located images | The original keeps all assets in a flat `static/` dir. Co-location makes deletes and renames atomic. |
| Slug URLs instead of `/blog/2026-08-16/` | Date URLs mean nothing to a reader or a search engine, and break if you reschedule. Date stays in front matter. |
| Draft support | Otherwise "unpublished" means a local branch, and you lose the preview-in-context loop. |
| `sitemap.xml`, `robots.txt`, `404.html` | Cheap, static, and Pages will serve your 404 for free. |
| `.nvmrc` + `node-version-file` | Local and CI Node stay pinned together instead of drifting. |
| `prefers-color-scheme` dark mode | Pure CSS, no JS, no toggle state to persist. |

### Deliberately not included

- **A CSS framework or build step for CSS.** One hand-written file under 150 lines needs neither.
- **Client-side JS.** No hydration, no analytics beacon, no comment widget. If you later want
  metrics, use a server-side-free option (Plausible/GoatCounter) and accept it as your first
  third-party request.
- **Tags/categories/pagination.** Add when you have 50 posts, not before.
- **A CMS.** Markdown in git *is* the CMS.

### Worth adding later, when the need is real

- `@11ty/eleventy-plugin-syntaxhighlight` — build-time Prism, no client JS. Add it the first time
  you publish a code-heavy post:
  ```js
  import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
  eleventyConfig.addPlugin(syntaxHighlight);
  ```
  Then paste a Prism theme into `style.css`.
- `markdown-it-anchor` + `markdown-it-toc-done-right` — heading anchors for long posts.
- `lycheeverse/lychee-action` on a weekly schedule — catches rotted external links.
- Dependabot (`.github/dependabot.yml`, monthly, npm) — three deps, so the noise is negligible.
- Generated OG images (satori/`eleventy-plugin-og-image`) — nice, but it's the first thing here
  that adds real build complexity. Only if you care about link previews.
- A PR preview deploy — genuinely useful only once someone else contributes.

---

## 7. Operational notes

- **Rollback** is `git revert` + push. The Actions run replaces the whole artifact; there is no
  partial state.
- **Build time** is a few seconds for hundreds of posts. `--incremental` keeps local rebuilds
  sub-second.
- **The output is inspectable.** `npm run build && ls -R _site` before debugging anything about
  deployment; the bug is almost always in `_site`, not in Pages.
- **Dates are UTC.** YAML parses `date: 2026-08-13` as midnight UTC and the formatter is pinned to
  UTC, so no off-by-one-day surprises across timezones.
