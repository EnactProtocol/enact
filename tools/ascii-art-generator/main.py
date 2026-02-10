import sys
import json
import pyfiglet

text = sys.argv[1]
ascii_art = pyfiglet.figlet_format(text)

print(json.dumps({"ascii_art": ascii_art}))
