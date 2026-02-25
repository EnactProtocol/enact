#!/usr/bin/env python3
"""Firecrawl API v2 tool for web scraping, crawling, searching, and extracting."""

import argparse
import json
import os
import sys
import time
import requests

API_BASE = "https://api.firecrawl.dev/v1"


def get_api_key():
    """Get the Firecrawl API key from environment."""
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        return None, "FIRECRAWL_API_KEY environment variable not set"
    return api_key, None


def scrape(url: str, formats: list[str], only_main_content: bool, api_key: str) -> dict:
    """Scrape a single URL and return content in specified formats."""
    response = requests.post(
        f"{API_BASE}/scrape",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "url": url,
            "formats": formats,
            "onlyMainContent": only_main_content,
        },
        timeout=120,
    )
    return response.json()


def crawl(url: str, limit: int, formats: list[str], api_key: str) -> dict:
    """Crawl a website and return all pages."""
    response = requests.post(
        f"{API_BASE}/crawl",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "url": url,
            "limit": limit,
            "scrapeOptions": {
                "formats": formats,
            },
        },
        timeout=30,
    )

    result = response.json()
    if not result.get("success"):
        return result

    job_id = result.get("id")
    if not job_id:
        return {"success": False, "error": "No job ID returned from crawl request"}

    max_attempts = 60
    for _ in range(max_attempts):
        status_response = requests.get(
            f"{API_BASE}/crawl/{job_id}",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30,
        )
        status = status_response.json()

        if status.get("status") == "completed":
            return status
        elif status.get("status") == "failed":
            return {"success": False, "error": status.get("error", "Crawl failed")}

        time.sleep(5)

    return {"success": False, "error": "Crawl timed out"}


def map_urls(url: str, search_query: str, api_key: str) -> dict:
    """Get all URLs from a website, optionally filtered by search query."""
    payload = {"url": url}
    if search_query:
        payload["search"] = search_query

    response = requests.post(
        f"{API_BASE}/map",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=60,
    )
    return response.json()


def search(query: str, limit: int, api_key: str) -> dict:
    """Search the web and return scraped results."""
    response = requests.post(
        f"{API_BASE}/search",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "query": query,
            "limit": limit,
        },
        timeout=120,
    )
    return response.json()


def extract(url: str, prompt: str, schema_str: str, api_key: str) -> dict:
    """Extract structured data from a URL using AI."""
    payload = {
        "urls": [url],
    }

    if prompt:
        payload["prompt"] = prompt

    if schema_str:
        try:
            payload["schema"] = json.loads(schema_str)
        except json.JSONDecodeError:
            return {"success": False, "error": f"Invalid JSON schema: {schema_str}"}

    response = requests.post(
        f"{API_BASE}/extract",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )

    result = response.json()
    if not result.get("success"):
        return result

    job_id = result.get("id")
    if not job_id:
        return result

    max_attempts = 60
    for _ in range(max_attempts):
        status_response = requests.get(
            f"{API_BASE}/extract/{job_id}",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30,
        )
        status = status_response.json()

        if status.get("status") == "completed":
            return status
        elif status.get("status") == "failed":
            return {"success": False, "error": status.get("error", "Extract failed")}

        time.sleep(2)

    return {"success": False, "error": "Extract timed out"}


def main():
    parser = argparse.ArgumentParser(description="Firecrawl API tool")
    parser.add_argument("--action", default="scrape", help="Action: scrape, crawl, map, search, extract")
    parser.add_argument("--url", help="URL to scrape/crawl/map/extract")
    parser.add_argument("--query", help="Search query (for search action)")
    parser.add_argument("--formats", default="markdown", help="Output formats, comma-separated")
    parser.add_argument("--limit", type=int, default=10, help="Max pages for crawl/search")
    parser.add_argument("--only_main_content", default="true", help="Only main content (true/false)")
    parser.add_argument("--prompt", default="", help="Prompt for extract action")
    parser.add_argument("--schema", default="", help="JSON schema for extract action")

    args = parser.parse_args()

    action = args.action
    url_or_query = args.url or args.query or ""
    formats = [f.strip() for f in args.formats.split(",")]
    limit = args.limit
    only_main_content = args.only_main_content.lower() == "true"
    prompt = args.prompt
    schema = args.schema

    if not url_or_query:
        print(json.dumps({"success": False, "error": "Missing --url or --query"}))
        sys.exit(1)

    api_key, error = get_api_key()
    if error:
        print(json.dumps({"success": False, "error": error}))
        sys.exit(1)

    try:
        if action == "scrape":
            result = scrape(url_or_query, formats, only_main_content, api_key)
        elif action == "crawl":
            result = crawl(url_or_query, limit, formats, api_key)
        elif action == "map":
            result = map_urls(url_or_query, prompt, api_key)
        elif action == "search":
            result = search(url_or_query, limit, api_key)
        elif action == "extract":
            result = extract(url_or_query, prompt, schema, api_key)
        else:
            result = {"success": False, "error": f"Unknown action: {action}"}

        output = {
            "success": result.get("success", True),
            "action": action,
            "url": url_or_query,
            "data": result.get("data", result),
        }

        if "error" in result:
            output["error"] = result["error"]
            output["success"] = False

        print(json.dumps(output, indent=2))

    except requests.exceptions.RequestException as e:
        print(json.dumps({
            "success": False,
            "action": action,
            "url": url_or_query,
            "error": f"Request failed: {str(e)}"
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "action": action,
            "url": url_or_query,
            "error": f"Unexpected error: {str(e)}"
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
