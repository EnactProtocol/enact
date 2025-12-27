/**
 * Post-build script to generate static HTML files with Open Graph meta tags
 * for each blog post. This enables proper social media previews for SPAs.
 *
 * Run after vite build: bun run scripts/generate-blog-meta.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "../dist");
const blogDir = join(distDir, "blog");

// Import blog posts data
// We need to read the source file and extract the data since it's TypeScript
const blogPostsSource = readFileSync(join(__dirname, "../src/data/blogPosts.ts"), "utf-8");

// Simple parser to extract blog post metadata from the TypeScript file
interface BlogPostMeta {
  title: string;
  excerpt: string;
  slug: string;
  date: string;
  author: string;
  tags: string[];
}

function extractBlogPosts(source: string): BlogPostMeta[] {
  const posts: BlogPostMeta[] = [];

  // Match each blog post object
  const postRegex =
    /\{\s*id:\s*"[^"]+",\s*title:\s*"([^"]+)",\s*excerpt:\s*"([^"]+)",\s*date:\s*"([^"]+)",\s*author:\s*"([^"]+)",\s*slug:\s*"([^"]+)",\s*tags:\s*\[([^\]]*)\]/g;

  let match: RegExpExecArray | null;
  while (true) {
    match = postRegex.exec(source);
    if (match === null) break;
    const [, title, excerpt, date, author, slug, tagsStr] = match;
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim().replace(/"/g, ""))
      .filter(Boolean);

    posts.push({ title, excerpt, date, author, slug, tags });
  }

  return posts;
}

function generateBlogHtml(post: BlogPostMeta, templateHtml: string): string {
  const url = `https://enact.tools/blog/${post.slug}`;

  // Replace the default meta tags with post-specific ones
  let html = templateHtml;

  // Update title
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${post.title} | Enact Blog</title>`);

  // Update description
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${post.excerpt}" />`
  );

  // Update Open Graph tags
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${url}" />`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${post.title}" />`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${post.excerpt}" />`
  );
  html = html.replace(
    /<meta property="og:type" content="[^"]*" \/>/,
    `<meta property="og:type" content="article" />`
  );

  // Update Twitter tags
  html = html.replace(
    /<meta property="twitter:url" content="[^"]*" \/>/,
    `<meta property="twitter:url" content="${url}" />`
  );
  html = html.replace(
    /<meta property="twitter:title" content="[^"]*" \/>/,
    `<meta property="twitter:title" content="${post.title}" />`
  );
  html = html.replace(
    /<meta property="twitter:description" content="[^"]*" \/>/,
    `<meta property="twitter:description" content="${post.excerpt}" />`
  );

  return html;
}

async function main() {
  console.log("Generating blog post meta tags...");

  // Check if dist exists
  if (!existsSync(distDir)) {
    console.error("Error: dist directory not found. Run 'bun run build' first.");
    process.exit(1);
  }

  // Read the template HTML
  const templatePath = join(distDir, "index.html");
  if (!existsSync(templatePath)) {
    console.error("Error: index.html not found in dist directory.");
    process.exit(1);
  }
  const templateHtml = readFileSync(templatePath, "utf-8");

  // Extract blog posts
  const posts = extractBlogPosts(blogPostsSource);
  console.log(`Found ${posts.length} blog posts`);

  // Create blog directory if it doesn't exist
  if (!existsSync(blogDir)) {
    mkdirSync(blogDir, { recursive: true });
  }

  // Generate HTML for each post
  for (const post of posts) {
    const postDir = join(blogDir, post.slug);
    if (!existsSync(postDir)) {
      mkdirSync(postDir, { recursive: true });
    }

    const html = generateBlogHtml(post, templateHtml);
    const outputPath = join(postDir, "index.html");
    writeFileSync(outputPath, html);
    console.log(`  Generated: /blog/${post.slug}/index.html`);
  }

  // Also create a blog index page
  const blogIndexHtml = templateHtml
    .replace(/<title>[^<]*<\/title>/, "<title>Blog | Enact</title>")
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      '<meta name="description" content="Updates, tutorials, and insights about the Enact protocol and ecosystem." />'
    )
    .replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      '<meta property="og:url" content="https://enact.tools/blog" />'
    )
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      '<meta property="og:title" content="Blog | Enact" />'
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      '<meta property="og:description" content="Updates, tutorials, and insights about the Enact protocol and ecosystem." />'
    )
    .replace(
      /<meta property="twitter:url" content="[^"]*" \/>/,
      '<meta property="twitter:url" content="https://enact.tools/blog" />'
    )
    .replace(
      /<meta property="twitter:title" content="[^"]*" \/>/,
      '<meta property="twitter:title" content="Blog | Enact" />'
    )
    .replace(
      /<meta property="twitter:description" content="[^"]*" \/>/,
      '<meta property="twitter:description" content="Updates, tutorials, and insights about the Enact protocol and ecosystem." />'
    );

  writeFileSync(join(blogDir, "index.html"), blogIndexHtml);
  console.log("  Generated: /blog/index.html");

  console.log("Done!");
}

main().catch(console.error);
