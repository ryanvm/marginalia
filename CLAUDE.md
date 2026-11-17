# CLAUDE.md

Personal blog. Static site, built with Eleventy 3, deployed to GitHub Pages by GitHub Actions.
See `BLOG-HANDOFF.md` for the full rationale behind the setup.

## Commands

```bash
npm start          # dev server at localhost:8080, incremental rebuilds, drafts visible
npm run build      # production build into _site/ ; drafts excluded
```

There are no tests and no linter. Verification is: build succeeds, then inspect `_site/`.

## Stack

- **Eleventy 3** (ESM config in `eleventy.config.js`), input `src/`, output `_site/`.
- **Nunjucks** layouts in `src/_includes/`, posts in **Markdown**.
- **Dev dependencies:** `@11ty/eleventy`, `@11ty/eleventy-plugin-rss`, `markdown-it-footnote`.
  That's the whole list.
- **Runtime dependencies: none.** Nothing executes at request time.

## Invariants — do not violate without being asked

1. **No client-side JavaScript.** No frameworks, no hydration, no analytics snippets, no embeds
   that pull in scripts. If a feature seems to need JS, propose a build-time alternative first.
2. **No new dependencies without asking.** Three dev deps is a feature. If a plugin genuinely
   earns its place (e.g. syntax highlighting for a code-heavy post), say so and wait for a yes.
3. **Never edit `_site/`.** It is generated and gitignored.
4. **Never hand-edit `feed.xml`, `sitemap.xml`, or anything else under `_site/`.** Change the
   template or the config.
5. **Site metadata lives in `site.config.js` only.** Don't hardcode the title, author, or base URL
   in a template — read it from the `site` global.
6. **No CSS preprocessor, no framework, no build step for styles.** `src/static/style.css` is
   hand-written and stays that way.
7. **Don't touch the `?v={{ cssHash }}` mechanism.** The hash is computed from the CSS file at
   build time; there is no version number to bump.

## Site structure (planned)

Served at `ryan.vanmiddlesworth.org`. More sections may be added later.

| URL | Purpose | Status |
| --- | --- | --- |
| `/` | Entry page | Currently the post index (`src/index.njk`) |
| `/musings` | Writing; replaces the old `/blog/` | Index at `src/musings.njk`, posts in `src/musings/` |
| `/about` | Personal details and career | Placeholder (`src/about.md`) |
| `/projects` | Projects | Placeholder (`src/projects.md`) |

Each new top-level page is a template or Markdown file in `src/` using `base.njk`, with no JS.
Link them from the header nav in `base.njk`.

## Adding a post

Create `src/musings/<slug>/index.md`:

```markdown
---
title: The Title
date: 2026-08-16
description: One sentence used for <meta description> and link previews.
draft: true
---

Body.
```

- The directory name becomes the URL: `/musings/<slug>/`. Use lowercase kebab-case.
- `layout` and `tags` are inherited from `src/musings/musings.json` — do not repeat them in front matter.
- Always write a `description`. The fallback is the site-wide blurb and is not useful per-post.
- `draft: true` renders locally and is excluded from production builds and the feed. Remove the
  line to publish.
- Images go **in the post directory** and are referenced relatively (`![Alt](./diagram.svg)`).
  Do not add post images to `src/static/`.
- Prefer SVG for diagrams. Always write meaningful `alt` text.
- Footnotes use `markdown-it-footnote` syntax (`[^1]` and `[^1]: text`).

## Directory map

| Path | Purpose |
| --- | --- |
| `site.config.js` | Title, description, base URL, author, socials. Single source of truth. |
| `eleventy.config.js` | Plugins, filters, passthrough copy, output dirs. |
| `src/_data/site.js` | Re-export of `site.config.js` so templates see `site.*`. |
| `src/_data/eleventyComputed.js` | Draft exclusion logic. |
| `src/_includes/base.njk` | HTML shell: head, meta/OG tags, header, socials. |
| `src/_includes/post.njk` | Post wrapper: title, date, draft banner. Chains to `base.njk`. |
| `src/musings/musings.json` | Directory data applied to every post. |
| `src/index.njk` | Post index, newest first. |
| `src/sitemap.njk` | Generates `/sitemap.xml`. |
| `src/404.md` | Served by Pages on 404. |
| `src/static/` | Copied verbatim to the output **root** (`/style.css`, `/robots.txt`). |

## Writing style for prose (when drafting or editing posts)

- Direct and concrete. Short paragraphs. No throat-clearing intro.
- No em-dash-heavy AI cadence, no "in today's fast-paced world", no "it's worth noting that".
- Don't invent facts, benchmarks, or citations. If a claim needs a source, ask for one or mark it.
- Match the voice of existing posts in `src/musings/`. Read one before writing.
- Never publish (remove `draft: true`) unless explicitly asked.

## Deployment

- Push to `main` → `.github/workflows/pages.yml` builds and deploys.
- Pages source must be set to **GitHub Actions** in repo settings, not branch deployment.
- The custom domain is configured in **Settings → Pages**, not via a `CNAME` file at the repo root
  (a root `CNAME` never reaches `_site` and does nothing).
- Node version is pinned in `.nvmrc` and read by the workflow via `node-version-file`.
- Rollback is `git revert` + push. Deploys replace the entire artifact; there is no partial state.

## Debugging

Almost every "it looks wrong in production" problem is visible locally:

```bash
npm run build && find _site -type f | sort
```

Check the file exists at the expected path before suspecting Pages or DNS.

Dates are parsed as UTC and formatted as UTC, deliberately. If a date renders one day off, the
front matter is wrong, not the formatter.
