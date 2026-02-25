#!/usr/bin/env node

const { chromium } = require("playwright-core");

function parseArgs(argv) {
  const result = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && i + 1 < argv.length) {
      result[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else if (!argv[i].startsWith("--")) {
      positional.push(argv[i]);
    }
  }
  return { ...result, _positional: positional };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const url = args.url || args._positional[0];
  const action = args.action || args._positional[1] || "text";
  const selector = args.selector || args._positional[2] || "body";

  if (!url) {
    console.error("Error: URL is required");
    console.error(
      "Usage: node run.js --url <url> [--action text|screenshot|html] [--selector <css>]"
    );
    process.exit(1);
  }

  console.log("Starting Playwright...");
  console.log(`URL: ${url}`);
  console.log(`Action: ${action}`);
  console.log(`Selector: ${selector}`);

  let browser;
  try {
    const fs = require("node:fs");
    const path = require("node:path");

    let executablePath;
    const msPlaywrightDir = "/ms-playwright";

    if (fs.existsSync(msPlaywrightDir)) {
      const dirs = fs.readdirSync(msPlaywrightDir);
      const chromiumDir = dirs.find((d) => d.startsWith("chromium-"));
      if (chromiumDir) {
        executablePath = path.join(msPlaywrightDir, chromiumDir, "chrome-linux", "chrome");
      }
    }

    console.log(`Using browser at: ${executablePath || "default"}`);

    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log("Page loaded successfully");

    switch (action) {
      case "screenshot": {
        const buffer = await page.screenshot({ fullPage: true });
        console.log("SCREENSHOT_START");
        console.log(buffer.toString("base64"));
        console.log("SCREENSHOT_END");
        break;
      }
      case "html": {
        const element = await page.locator(selector);
        const html = await element.innerHTML();
        console.log(html);
        break;
      }
      default: {
        const element = await page.locator(selector);
        const text = await element.textContent();
        console.log(text?.trim() || "");
        break;
      }
    }
  } catch (error) {
    console.error("Playwright Error:", error.message);
    if (error.stack) {
      console.error("Stack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
