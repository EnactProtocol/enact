---
name: playwright
description: "Automates headless Chromium to scrape text, capture full-page screenshots, and extract HTML from web pages using Playwright. Use when the user asks to scrape a website, take a screenshot of a URL, extract page content, or automate browser interactions."
---

# Playwright Browser Automation

Navigates to a URL in headless Chromium and performs one of three actions: extract text content (default), take a full-page screenshot, or extract raw HTML. Supports targeting specific elements via CSS selectors.

## Usage

```bash
# Extract text content from a page (default action)
enact run enact/playwright -a '{"url": "https://example.com"}'

# Take a full-page screenshot (returns base64-encoded PNG)
enact run enact/playwright -a '{"url": "https://example.com", "action": "screenshot"}'

# Extract HTML from a specific element
enact run enact/playwright -a '{"url": "https://example.com", "action": "html", "selector": "main"}'

# Extract text from a specific element
enact run enact/playwright -a '{"url": "https://example.com", "selector": "h1"}'
```

## Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `url` | string | *(required)* | Target URL to navigate to |
| `action` | string | `"text"` | One of `text`, `screenshot`, or `html` |
| `selector` | string | `"body"` | CSS selector to target a specific element |

## Error Handling

- Missing `url` exits with an error message and usage hint
- Navigation timeout is 30 seconds; pages that fail to load produce a `Playwright Error` with a stack trace
- Invalid selectors raise a locator error
