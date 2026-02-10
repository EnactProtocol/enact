# Playwright Browser Automation

A browser automation tool that uses Playwright to interact with web pages.

## Features

- Navigate to any URL
- Take screenshots
- Extract text content
- Extract HTML content
- Target specific elements with CSS selectors

## Usage

```bash
# Get text content from a page
enact run enact/playwright -a '{"url": "https://example.com"}'

# Take a screenshot
enact run enact/playwright -a '{"url": "https://example.com", "action": "screenshot"}'

# Extract text from a specific element
enact run enact/playwright -a '{"url": "https://example.com", "selector": "h1"}'
```
