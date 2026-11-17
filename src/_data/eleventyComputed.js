// Drafts render locally (`npm start`) and vanish from production builds.
const isProdBuild = () => process.env.ELEVENTY_RUN_MODE === "build";

export default {
  eleventyExcludeFromCollections: (data) =>
    data.draft && isProdBuild() ? true : data.eleventyExcludeFromCollections,
  permalink: (data) => (data.draft && isProdBuild() ? false : data.permalink),
};
