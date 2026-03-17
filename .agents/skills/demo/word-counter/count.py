import sys
import json
import argparse

parser = argparse.ArgumentParser(description="Count words in text")
parser.add_argument("--text", required=True, help="Text to analyze")
args = parser.parse_args()

text = args.text
words = text.split()

print(json.dumps({
    "word_count": len(words),
    "char_count": len(text),
    "words": words,
    "unique_words": len(set(w.lower().strip(".,!?") for w in words))
}))
