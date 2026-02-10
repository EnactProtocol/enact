# Firecrawl Web Scraping Tool

A powerful web scraping tool that uses the [Firecrawl API](https://firecrawl.dev) to convert websites into clean, LLM-ready markdown and extract structured data.

## Features

- **Scrape**: Extract content from a single URL as markdown, HTML, or with screenshots
- **Crawl**: Automatically discover and scrape all accessible subpages of a website
- **Map**: Get a list of all URLs from a website without scraping content (extremely fast)
- **Search**: Search the web and get full scraped content from results
- **Extract**: Use AI to extract structured data from pages with natural language prompts

## Setup

1. Get an API key from [firecrawl.dev](https://firecrawl.dev)
2. Set your API key as a secret:
   ```bash
   enact env set FIRECRAWL_API_KEY <your-api-key> --secret --namespace enact
   ```

This stores your API key securely in your OS keyring (macOS Keychain, Windows Credential Manager, or Linux Secret Service).

## Usage Examples

### Scrape a single page
```bash
enact run enact/firecrawl -a '{"url": "https://example.com", "action": "scrape"}'
```

### Crawl an entire documentation site
```bash
enact run enact/firecrawl -a '{"url": "https://docs.example.com", "action": "crawl", "limit": 20}'
```

### Map all URLs on a website
```bash
enact run enact/firecrawl -a '{"url": "https://example.com", "action": "map"}'
```

### Search the web
```bash
enact run enact/firecrawl -a '{"url": "latest AI developments 2024", "action": "search", "limit": 5}'
```

### Extract structured data with AI
```bash
enact run enact/firecrawl -a '{"url": "https://news.ycombinator.com", "action": "extract", "prompt": "Extract the top 10 news headlines with their URLs"}'
```

## Output

The tool returns JSON with:
- **markdown**: Clean, LLM-ready content
- **metadata**: Title, description, language, source URL
- **extract**: Structured data (for extract action)
- **links**: Discovered URLs (for map action)

## API Features

Firecrawl handles the hard parts of web scraping:
- Anti-bot mechanisms
- Dynamic JavaScript content
- Proxies and rate limiting
- PDF and document parsing
- Screenshot capture
