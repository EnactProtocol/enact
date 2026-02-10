# WhatWeb Scanner

Next generation web scanner that identifies websites and detects web technologies, CMS platforms, JavaScript libraries, web servers, and embedded devices.

**Homepage:** https://morningstarsecurity.com/research/whatweb

## Usage

Basic scan:
```bash
enact run enact/scanner/whatweb -a '{"url": "https://github.com"}'
```

Aggressive scan with verbose output:
```bash
enact run enact/scanner/whatweb -a '{"url": "https://example.com", "aggression": 3, "verbose": true}'
```

Custom plugins and user agent:
```bash
enact run enact/scanner/whatweb -a '{"url": "https://example.com", "plugins": "title,md5,wordpress", "user_agent": "Mozilla/5.0"}'
```

High-performance scan:
```bash
enact run enact/scanner/whatweb -a '{"url": "https://example.com", "no_cookies": true, "no_errors": true, "max_threads": 50}'
```

## Aggression Levels

- **1 (Stealthy):** Makes one HTTP request per target. Follows redirects. Default and recommended.
- **3 (Aggressive):** If a level 1 plugin matches, additional requests are made for confirmation.
- **4 (Heavy):** Makes many HTTP requests per target. All aggressive tests from all plugins are used.

## What It Detects

WhatWeb recognizes hundreds of web technologies including:
- **CMS platforms:** WordPress, Drupal, Joomla, etc.
- **Web frameworks:** Rails, Django, Laravel, etc.
- **JavaScript libraries:** jQuery, React, Angular, etc.
- **Web servers:** Apache, Nginx, IIS, etc.
- **Analytics tools:** Google Analytics, etc.
- **Programming languages:** PHP, Python, Ruby, etc.
- **CDNs:** Cloudflare, Akamai, etc.

## Parameters

- **url** (required): Target URL, hostname, or IP address
- **aggression** (default: 1): Controls speed/stealth vs reliability trade-off (1, 3, or 4)
- **verbose** (default: false): Include detailed plugin descriptions in output
- **user_agent** (default: ""): Custom User-Agent string for requests
- **plugins** (default: ""): Specific plugins to use (comma-separated, empty = all)
- **no_errors** (default: false): Suppress error messages for cleaner output
- **max_threads** (default: 25): Number of concurrent threads
- **no_cookies** (default: false): Disable cookie handling for better performance with high thread counts
- **output_format** (default: "json"): Return format - `json` or `text`

## Example Output

```json
{
  "target": "https://github.com",
  "http_status": 200,
  "plugins": {
    "HTTPServer": ["GitHub.com"],
    "Title": ["GitHub: Let's build from here"],
    "HTML5": {},
    "Script": ["application/json", "text/javascript"]
  }
}
```
