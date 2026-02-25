import sys
import json
import argparse
import pyfiglet

parser = argparse.ArgumentParser(description="Generate ASCII art from text")
parser.add_argument("text", nargs="?", help="Text to convert to ASCII art")
parser.add_argument("--text", dest="text_flag", help="Text to convert to ASCII art")

args = parser.parse_args()
text = args.text_flag or args.text

if not text:
    print(json.dumps({"error": "No text provided. Usage: main.py <text> or main.py --text <text>"}))
    sys.exit(1)

ascii_art = pyfiglet.figlet_format(text)
print(json.dumps({"ascii_art": ascii_art}))
