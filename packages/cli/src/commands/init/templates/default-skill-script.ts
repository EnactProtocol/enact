/**
 * hello.py script template for default init
 */
export const defaultSkillScriptTemplate = `import sys
import json

name = sys.argv[1] if len(sys.argv) > 1 else "World"

print(json.dumps({"message": f"Hello, {name}!"}))
`;
