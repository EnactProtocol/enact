# Enact: Explain Like I'm 5

## What is Enact?

**Enact is like an App Store for AI tools.**

You know how your phone has an App Store where you can download apps that do different things? Enact is similar, but for tools that AI assistants (like ChatGPT or Claude) can use.

---

## The Problem Enact Solves

Imagine you ask an AI assistant: *"Can you resize this image for me?"*

The AI is smart, but it can't actually touch files on your computer. It's like asking a really smart friend who's trapped inside a phone - they can give you advice, but they can't physically do things.

**Enact gives AI assistants hands.**

With Enact, someone can create a "resize image" tool, publish it, and then any AI can use it to actually resize images.

---

## How It Works (Simple Version)

### 1. Someone Creates a Tool

```
"Hey, I made a tool that resizes images!"
```

They write a small file that says:
- What the tool does
- What inputs it needs (like the image and the new size)
- What it outputs (the resized image)

### 2. They Publish It

```
enact publish my-image-resizer
```

Now it's in the Enact registry (the "App Store") for everyone to use.

### 3. Anyone Can Use It

```
enact run alice/images/resizer --input "image=photo.jpg" --input "width=800"
```

The tool runs in a safe container (like a sandbox) and returns the result.

### 4. AI Assistants Can Use It Too

When an AI has access to Enact, it can:
1. Search for tools: *"Is there a tool to resize images?"*
2. Find one: `alice/images/resizer`
3. Run it: Pass the image, get the resized version back

---

## Why Containers?

Every Enact tool runs in a **container**. Think of it like this:

Imagine you're baking cookies at a friend's house. You could:

**Option A: Use their kitchen directly**
- Might mess up their kitchen
- Might not have the right ingredients
- Different oven = different results

**Option B: Bring a portable kitchen (container)**
- Includes everything you need
- Works the same everywhere
- Doesn't mess up their kitchen
- When done, pack it up and leave no trace

Enact uses Option B. Each tool brings its own "portable kitchen" with all the software it needs.

---

## Real Example

Let's say you want to create a tool that counts words in text.

### Step 1: Create the tool folder

```
word-counter/
├── enact.md      # Describes the tool
└── count.py      # The actual code
```

### Step 2: Write enact.md

```markdown
---
name: "myname/text/word-counter"
description: "Counts words in text"
from: "python:3.12-slim"
command: "python /work/count.py ${text}"

inputSchema:
  type: object
  properties:
    text:
      type: string
      description: "Text to count words in"
  required: [text]
---

# Word Counter

Give it text, get back the word count.
```

### Step 3: Write the code (count.py)

```python
import sys
import json

text = sys.argv[1]
word_count = len(text.split())

print(json.dumps({"count": word_count}))
```

### Step 4: Test it

```bash
enact run . --input "text=Hello world this is a test"
# Output: {"count": 6}
```

### Step 5: Publish it

```bash
enact publish .
# Now anyone can use: enact run myname/text/word-counter
```

---

## Two Types of Tools

### 1. Container Tools (Do Things)

These have a `command` and actually run code:

```yaml
command: "python /work/script.py ${input}"
```

Use these for:
- Processing files
- Calling APIs
- Running calculations
- Anything that needs to *do* something

### 2. Instruction Tools (Guide AI)

These have NO `command` - just instructions for the AI:

```markdown
---
name: "myname/prompts/code-reviewer"
description: "Reviews code for bugs"
---

# Code Reviewer

You are a senior developer. Review the code for:
1. Bugs
2. Security issues
3. Performance problems

Be specific and suggest fixes.
```

Use these for:
- Prompts
- Workflows
- Guidelines
- Anything that tells the AI *how* to think

---

## Key Concepts

| Term | Plain English |
|------|---------------|
| **Tool** | A reusable thing that does one job |
| **Registry** | The "App Store" where tools live |
| **Container** | A safe sandbox that runs the tool |
| **Manifest** | The `enact.md` file describing the tool |
| **Namespace** | Your username prefix (like `alice/tools/thing`) |

---

## Why Should I Care?

### If you're a developer:
- Share your tools with the world
- Use other people's tools
- Build tools that AI can use

### If you're using AI:
- AI assistants can do more things
- Tools are safe (sandboxed)
- Tools are reliable (same result every time)

### If you're building AI products:
- Standard way to give AI capabilities
- Tools are discoverable and documented
- Built-in security (containers, signing)

---

## Frequently Asked Questions

### Is it safe?

Yes! Tools run in isolated containers. They can't access your files or computer unless you explicitly give them permission.

### Do I need to know how to code?

- **To use tools:** No! Just `enact run author/tool --input "..."`
- **To create tools:** Yes, but any language works (Python, JavaScript, Go, Rust, etc.)

### Is it free?

The public registry is free. Private registries for teams may have costs.

### How is this different from npm/pip/etc?

Those are package managers for code libraries. Enact is for **runnable tools** - things that take input and produce output, running in containers.

---

## Getting Started

### Install Enact

```bash
npm install -g @enact/cli
# or
brew install enact
```

### Run a tool

```bash
enact run enact/examples/hello --input "name=World"
```

### Create your first tool

```bash
mkdir my-tool && cd my-tool
# Create enact.md and your code
enact run . --input "..."
```

### Publish it

```bash
enact auth login
enact publish .
```

---

## One-Liner Summary

> **Enact = App Store for AI tools, where each tool runs safely in its own container.**

That's it! Now you understand Enact.
