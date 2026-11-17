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
  eleventyConfig.addPassthroughCopy("src/musings/**/*.{png,jpg,jpeg,gif,svg,webp,avif}");

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
