// source.config.ts
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
var docs = defineDocs({
  dir: "content/docs"
});
var pages = defineDocs({
  dir: "content/pages"
});
var posts = defineDocs({
  dir: "content/posts"
});
var source_config_default = defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        light: "github-light",
        dark: "github-dark"
      },
      // Use defaultLanguage for unknown language codes
      defaultLanguage: "plaintext"
    }
  }
});
export {
  source_config_default as default,
  docs,
  pages,
  posts
};
