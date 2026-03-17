import sys
import json
import argparse

parser = argparse.ArgumentParser(description="Generate a text analysis report")
parser.add_argument("--text", required=True, help="Original text")
parser.add_argument("--word_count", required=True, type=int, help="Word count")
parser.add_argument("--char_count", required=True, type=int, help="Character count")
parser.add_argument("--unique_words", type=int, default=0, help="Unique word count")
args = parser.parse_args()

# Determine reading complexity grade
avg_word_len = args.char_count / max(args.word_count, 1)
if avg_word_len < 4:
    grade = "Simple"
elif avg_word_len < 6:
    grade = "Moderate"
else:
    grade = "Complex"

# Vocabulary richness
richness = (args.unique_words / max(args.word_count, 1)) * 100 if args.unique_words else 0

report_lines = [
    "=" * 40,
    "  TEXT ANALYSIS REPORT",
    "=" * 40,
    f"  Words:        {args.word_count}",
    f"  Characters:   {args.char_count}",
    f"  Unique words: {args.unique_words or 'N/A'}",
    f"  Avg word len: {avg_word_len:.1f} chars",
    f"  Vocabulary:   {richness:.0f}% unique",
    f"  Complexity:   {grade}",
    "=" * 40,
    f"  Preview: \"{args.text[:50]}{'...' if len(args.text) > 50 else ''}\"",
    "=" * 40,
]

print(json.dumps({
    "report": "\n".join(report_lines),
    "grade": grade,
    "stats": {
        "word_count": args.word_count,
        "char_count": args.char_count,
        "avg_word_length": round(avg_word_len, 1),
        "vocabulary_richness_pct": round(richness, 1)
    }
}))
