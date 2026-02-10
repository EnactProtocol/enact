> ## Documentation Index
> Fetch the complete documentation index at: https://agentskills.io/llms.txt
> Use this file to discover all available pages before exploring further.

# Overview

> A simple, open format for giving agents new capabilities and expertise.

export const LogoCarousel = () => {
  const logos = [{
    name: "Gemini CLI",
    url: "https://geminicli.com",
    lightSrc: "/images/logos/gemini-cli/gemini-cli-logo_light.svg",
    darkSrc: "/images/logos/gemini-cli/gemini-cli-logo_dark.svg"
  }, {
    name: "Autohand Code CLI",
    url: "https://autohand.ai/",
    lightSrc: "/images/logos/autohand/autohand-light.svg",
    darkSrc: "/images/logos/autohand/autohand-dark.svg",
    width: "120px"
  }, {
    name: "OpenCode",
    url: "https://opencode.ai/",
    lightSrc: "/images/logos/opencode/opencode-wordmark-light.svg",
    darkSrc: "/images/logos/opencode/opencode-wordmark-dark.svg"
  }, {
    name: "Mux",
    url: "https://mux.coder.com/",
    lightSrc: "/images/logos/mux/mux-editor-light.svg",
    darkSrc: "/images/logos/mux/mux-editor-dark.svg",
    width: "120px"
  }, {
    name: "Cursor",
    url: "https://cursor.com/",
    lightSrc: "/images/logos/cursor/LOCKUP_HORIZONTAL_2D_LIGHT.svg",
    darkSrc: "/images/logos/cursor/LOCKUP_HORIZONTAL_2D_DARK.svg"
  }, {
    name: "Amp",
    url: "https://ampcode.com/",
    lightSrc: "/images/logos/amp/amp-logo-light.svg",
    darkSrc: "/images/logos/amp/amp-logo-dark.svg",
    width: "120px"
  }, {
    name: "Letta",
    url: "https://www.letta.com/",
    lightSrc: "/images/logos/letta/Letta-logo-RGB_OffBlackonTransparent.svg",
    darkSrc: "/images/logos/letta/Letta-logo-RGB_GreyonTransparent.svg"
  }, {
    name: "Firebender",
    url: "https://firebender.com/",
    lightSrc: "/images/logos/firebender/firebender-wordmark-light.svg",
    darkSrc: "/images/logos/firebender/firebender-wordmark-dark.svg"
  }, {
    name: "Goose",
    url: "https://block.github.io/goose/",
    lightSrc: "/images/logos/goose/goose-logo-black.png",
    darkSrc: "/images/logos/goose/goose-logo-white.png"
  }, {
    name: "GitHub",
    url: "https://github.com/",
    lightSrc: "/images/logos/github/GitHub_Lockup_Dark.svg",
    darkSrc: "/images/logos/github/GitHub_Lockup_Light.svg"
  }, {
    name: "VS Code",
    url: "https://code.visualstudio.com/",
    lightSrc: "/images/logos/vscode/vscode.svg",
    darkSrc: "/images/logos/vscode/vscode-alt.svg"
  }, {
    name: "Claude Code",
    url: "https://claude.ai/code",
    lightSrc: "/images/logos/claude-code/Claude-Code-logo-Slate.svg",
    darkSrc: "/images/logos/claude-code/Claude-Code-logo-Ivory.svg"
  }, {
    name: "Claude",
    url: "https://claude.ai/",
    lightSrc: "/images/logos/claude-ai/Claude-logo-Slate.svg",
    darkSrc: "/images/logos/claude-ai/Claude-logo-Ivory.svg"
  }, {
    name: "OpenAI Codex",
    url: "https://developers.openai.com/codex",
    lightSrc: "/images/logos/oai-codex/OAI_Codex-Lockup_400px.svg",
    darkSrc: "/images/logos/oai-codex/OAI_Codex-Lockup_400px_Darkmode.svg"
  }, {
    name: "Piebald",
    url: "https://piebald.ai",
    lightSrc: "/images/logos/piebald/Piebald_wordmark_light.svg",
    darkSrc: "/images/logos/piebald/Piebald_wordmark_dark.svg"
  }, {
    name: "Factory",
    url: "https://factory.ai/",
    lightSrc: "/images/logos/factory/factory-logo-light.svg",
    darkSrc: "/images/logos/factory/factory-logo-dark.svg"
  }, {
    name: "pi",
    url: "https://shittycodingagent.ai/",
    lightSrc: "/images/logos/pi/pi-logo-light.svg",
    darkSrc: "/images/logos/pi/pi-logo-dark.svg",
    width: "80px"
  }, {
    name: "Databricks",
    url: "https://databricks.com/",
    lightSrc: "/images/logos/databricks/databricks-logo-light.svg",
    darkSrc: "/images/logos/databricks/databricks-logo-dark.svg"
  }, {
    name: "Agentman",
    url: "https://agentman.ai/",
    lightSrc: "/images/logos/agentman/agentman-wordmark-light.svg",
    darkSrc: "/images/logos/agentman/agentman-wordmark-dark.svg"
  }, {
    name: "TRAE",
    url: "https://trae.ai/",
    lightSrc: "/images/logos/trae/trae-logo-lightmode.svg",
    darkSrc: "/images/logos/trae/trae-logo-darkmode.svg"
  }, {
    name: "Spring AI",
    url: "https://docs.spring.io/spring-ai/reference",
    lightSrc: "/images/logos/spring-ai/spring-ai-logo-light.svg",
    darkSrc: "/images/logos/spring-ai/spring-ai-logo-dark.svg"
  }, {
    name: "Roo Code",
    url: "https://roocode.com",
    lightSrc: "/images/logos/roo-code/roo-code-logo-black.svg",
    darkSrc: "/images/logos/roo-code/roo-code-logo-white.svg"
  }, {
    name: "Mistral AI Vibe",
    url: "https://github.com/mistralai/mistral-vibe",
    lightSrc: "/images/logos/mistral-vibe/vibe-logo_black.svg",
    darkSrc: "/images/logos/mistral-vibe/vibe-logo_white.svg",
    width: "80px"
  }, {
    name: "Command Code",
    url: "https://commandcode.ai/",
    lightSrc: "/images/logos/command-code/command-code-logo-for-light.svg",
    darkSrc: "/images/logos/command-code/command-code-logo-for-dark.svg",
    width: "200px"
  }, {
    name: "Ona",
    url: "https://ona.com",
    lightSrc: "/images/logos/ona/ona-wordmark-light.svg",
    darkSrc: "/images/logos/ona/ona-wordmark-dark.svg",
    width: "120px"
  }, {
    name: "VT Code",
    url: "https://github.com/vinhnx/vtcode",
    lightSrc: "/images/logos/vtcode/vt_code_light.svg",
    darkSrc: "/images/logos/vtcode/vt_code_dark.svg"
  }, {
    name: "Qodo",
    url: "https://www.qodo.ai/",
    lightSrc: "/images/logos/qodo/qodo-logo-light.png",
    darkSrc: "/images/logos/qodo/qodo-logo-dark.svg"
  }];
  const [shuffled, setShuffled] = useState(logos);
  useEffect(() => {
    const shuffle = items => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    setShuffled(shuffle(logos));
  }, []);
  const row1 = shuffled.filter((_, i) => i % 2 === 0);
  const row2 = shuffled.filter((_, i) => i % 2 === 1);
  const row1Doubled = [...row1, ...row1];
  const row2Doubled = [...row2, ...row2];
  return <>
      <div className="logo-carousel">
        <div className="logo-carousel-track" style={{
    animation: 'logo-scroll 50s linear infinite'
  }}>
          {row1Doubled.map((logo, i) => <a key={`${logo.name}-${i}`} href={logo.url} style={{
    textDecoration: 'none',
    border: 'none'
  }}>
              <img className="block dark:hidden object-contain" style={{
    width: logo.width || '150px',
    maxWidth: '100%'
  }} src={logo.lightSrc} alt={logo.name} />
              <img className="hidden dark:block object-contain" style={{
    width: logo.width || '150px',
    maxWidth: '100%'
  }} src={logo.darkSrc} alt={logo.name} />
            </a>)}
        </div>
      </div>
      <div className="logo-carousel">
        <div className="logo-carousel-track" style={{
    animation: 'logo-scroll 60s linear infinite reverse'
  }}>
          {row2Doubled.map((logo, i) => <a key={`${logo.name}-${i}`} href={logo.url} style={{
    textDecoration: 'none',
    border: 'none'
  }}>
              <img className="block dark:hidden object-contain" style={{
    width: logo.width || '150px',
    maxWidth: '100%'
  }} src={logo.lightSrc} alt={logo.name} />
              <img className="hidden dark:block object-contain" style={{
    width: logo.width || '150px',
    maxWidth: '100%'
  }} src={logo.darkSrc} alt={logo.name} />
            </a>)}
        </div>
      </div>
    </>;
};

Agent Skills are folders of instructions, scripts, and resources that agents can discover and use to do things more accurately and efficiently.

## Why Agent Skills?

Agents are increasingly capable, but often don't have the context they need to do real work reliably. Skills solve this by giving agents access to procedural knowledge and company-, team-, and user-specific context they can load on demand. Agents with access to a set of skills can extend their capabilities based on the task they're working on.

**For skill authors**: Build capabilities once and deploy them across multiple agent products.

**For compatible agents**: Support for skills lets end users give agents new capabilities out of the box.

**For teams and enterprises**: Capture organizational knowledge in portable, version-controlled packages.

## What can Agent Skills enable?

* **Domain expertise**: Package specialized knowledge into reusable instructions, from legal review processes to data analysis pipelines.
* **New capabilities**: Give agents new capabilities (e.g. creating presentations, building MCP servers, analyzing datasets).
* **Repeatable workflows**: Turn multi-step tasks into consistent and auditable workflows.
* **Interoperability**: Reuse the same skill across different skills-compatible agent products.

## Adoption

Agent Skills are supported by leading AI development tools.

<LogoCarousel />

## Open development

The Agent Skills format was originally developed by [Anthropic](https://www.anthropic.com/), released as an open standard, and has been adopted by a growing number of agent products. The standard is open to contributions from the broader ecosystem.

[View on GitHub](https://github.com/agentskills/agentskills)

## Get started

<CardGroup cols={3}>
  <Card title="What are skills?" icon="lightbulb" href="/what-are-skills">
    Learn about skills, how they work, and why they matter.
  </Card>

  <Card title="Specification" icon="file-code" href="/specification">
    The complete format specification for SKILL.md files.
  </Card>

  <Card title="Integrate skills" icon="gear" href="/integrate-skills">
    Add skills support to your agent or tool.
  </Card>

  <Card title="Example skills" icon="code" href="https://github.com/anthropics/skills">
    Browse example skills on GitHub.
  </Card>

  <Card title="Reference library" icon="wrench" href="https://github.com/agentskills/agentskills/tree/main/skills-ref">
    Validate skills and generate prompt XML.
  </Card>
</CardGroup>


> ## Documentation Index
> Fetch the complete documentation index at: https://agentskills.io/llms.txt
> Use this file to discover all available pages before exploring further.

# What are skills?

> Agent Skills are a lightweight, open format for extending AI agent capabilities with specialized knowledge and workflows.

At its core, a skill is a folder containing a `SKILL.md` file. This file includes metadata (`name` and `description`, at minimum) and instructions that tell an agent how to perform a specific task. Skills can also bundle scripts, templates, and reference materials.

```directory  theme={null}
my-skill/
├── SKILL.md          # Required: instructions + metadata
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation
└── assets/           # Optional: templates, resources
```

## How skills work

Skills use **progressive disclosure** to manage context efficiently:

1. **Discovery**: At startup, agents load only the name and description of each available skill, just enough to know when it might be relevant.

2. **Activation**: When a task matches a skill's description, the agent reads the full `SKILL.md` instructions into context.

3. **Execution**: The agent follows the instructions, optionally loading referenced files or executing bundled code as needed.

This approach keeps agents fast while giving them access to more context on demand.

## The SKILL.md file

Every skill starts with a `SKILL.md` file containing YAML frontmatter and Markdown instructions:

```mdx  theme={null}
---
name: pdf-processing
description: Extract text and tables from PDF files, fill forms, merge documents.
---

# PDF Processing

## When to use this skill
Use this skill when the user needs to work with PDF files...

## How to extract text
1. Use pdfplumber for text extraction...

## How to fill forms
...
```

The following frontmatter is required at the top of `SKILL.md`:

* `name`: A short identifier
* `description`: When to use this skill

The Markdown body contains the actual instructions and has no specific restrictions on structure or content.

This simple format has some key advantages:

* **Self-documenting**: A skill author or user can read a `SKILL.md` and understand what it does, making skills easy to audit and improve.

* **Extensible**: Skills can range in complexity from just text instructions to executable code, assets, and templates.

* **Portable**: Skills are just files, so they're easy to edit, version, and share.

## Next steps

* [View the specification](/specification) to understand the full format.
* [Add skills support to your agent](/integrate-skills) to build a compatible client.
* [See example skills](https://github.com/anthropics/skills) on GitHub.
* [Read authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) for writing effective skills.
* [Use the reference library](https://github.com/agentskills/agentskills/tree/main/skills-ref) to validate skills and generate prompt XML.


> ## Documentation Index
> Fetch the complete documentation index at: https://agentskills.io/llms.txt
> Use this file to discover all available pages before exploring further.

# Specification

> The complete format specification for Agent Skills.

This document defines the Agent Skills format.

## Directory structure

A skill is a directory containing at minimum a `SKILL.md` file:

```
skill-name/
└── SKILL.md          # Required
```

<Tip>
  You can optionally include [additional directories](#optional-directories) such as `scripts/`, `references/`, and `assets/` to support your skill.
</Tip>

## SKILL.md format

The `SKILL.md` file must contain YAML frontmatter followed by Markdown content.

### Frontmatter (required)

```yaml  theme={null}
---
name: skill-name
description: A description of what this skill does and when to use it.
---
```

With optional fields:

```yaml  theme={null}
---
name: pdf-processing
description: Extract text and tables from PDF files, fill forms, merge documents.
license: Apache-2.0
metadata:
  author: example-org
  version: "1.0"
---
```

| Field           | Required | Constraints                                                                                                       |
| --------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `name`          | Yes      | Max 64 characters. Lowercase letters, numbers, and hyphens only. Must not start or end with a hyphen.             |
| `description`   | Yes      | Max 1024 characters. Non-empty. Describes what the skill does and when to use it.                                 |
| `license`       | No       | License name or reference to a bundled license file.                                                              |
| `compatibility` | No       | Max 500 characters. Indicates environment requirements (intended product, system packages, network access, etc.). |
| `metadata`      | No       | Arbitrary key-value mapping for additional metadata.                                                              |
| `allowed-tools` | No       | Space-delimited list of pre-approved tools the skill may use. (Experimental)                                      |

#### `name` field

The required `name` field:

* Must be 1-64 characters
* May only contain unicode lowercase alphanumeric characters and hyphens (`a-z` and `-`)
* Must not start or end with `-`
* Must not contain consecutive hyphens (`--`)
* Must match the parent directory name

Valid examples:

```yaml  theme={null}
name: pdf-processing
```

```yaml  theme={null}
name: data-analysis
```

```yaml  theme={null}
name: code-review
```

Invalid examples:

```yaml  theme={null}
name: PDF-Processing  # uppercase not allowed
```

```yaml  theme={null}
name: -pdf  # cannot start with hyphen
```

```yaml  theme={null}
name: pdf--processing  # consecutive hyphens not allowed
```

#### `description` field

The required `description` field:

* Must be 1-1024 characters
* Should describe both what the skill does and when to use it
* Should include specific keywords that help agents identify relevant tasks

Good example:

```yaml  theme={null}
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction.
```

Poor example:

```yaml  theme={null}
description: Helps with PDFs.
```

#### `license` field

The optional `license` field:

* Specifies the license applied to the skill
* We recommend keeping it short (either the name of a license or the name of a bundled license file)

Example:

```yaml  theme={null}
license: Proprietary. LICENSE.txt has complete terms
```

#### `compatibility` field

The optional `compatibility` field:

* Must be 1-500 characters if provided
* Should only be included if your skill has specific environment requirements
* Can indicate intended product, required system packages, network access needs, etc.

Examples:

```yaml  theme={null}
compatibility: Designed for Claude Code (or similar products)
```

```yaml  theme={null}
compatibility: Requires git, docker, jq, and access to the internet
```

<Note>
  Most skills do not need the `compatibility` field.
</Note>

#### `metadata` field

The optional `metadata` field:

* A map from string keys to string values
* Clients can use this to store additional properties not defined by the Agent Skills spec
* We recommend making your key names reasonably unique to avoid accidental conflicts

Example:

```yaml  theme={null}
metadata:
  author: example-org
  version: "1.0"
```

#### `allowed-tools` field

The optional `allowed-tools` field:

* A space-delimited list of tools that are pre-approved to run
* Experimental. Support for this field may vary between agent implementations

Example:

```yaml  theme={null}
allowed-tools: Bash(git:*) Bash(jq:*) Read
```

### Body content

The Markdown body after the frontmatter contains the skill instructions. There are no format restrictions. Write whatever helps agents perform the task effectively.

Recommended sections:

* Step-by-step instructions
* Examples of inputs and outputs
* Common edge cases

Note that the agent will load this entire file once it's decided to activate a skill. Consider splitting longer `SKILL.md` content into referenced files.

## Optional directories

### scripts/

Contains executable code that agents can run. Scripts should:

* Be self-contained or clearly document dependencies
* Include helpful error messages
* Handle edge cases gracefully

Supported languages depend on the agent implementation. Common options include Python, Bash, and JavaScript.

### references/

Contains additional documentation that agents can read when needed:

* `REFERENCE.md` - Detailed technical reference
* `FORMS.md` - Form templates or structured data formats
* Domain-specific files (`finance.md`, `legal.md`, etc.)

Keep individual [reference files](#file-references) focused. Agents load these on demand, so smaller files mean less use of context.

### assets/

Contains static resources:

* Templates (document templates, configuration templates)
* Images (diagrams, examples)
* Data files (lookup tables, schemas)

## Progressive disclosure

Skills should be structured for efficient use of context:

1. **Metadata** (\~100 tokens): The `name` and `description` fields are loaded at startup for all skills
2. **Instructions** (\< 5000 tokens recommended): The full `SKILL.md` body is loaded when the skill is activated
3. **Resources** (as needed): Files (e.g. those in `scripts/`, `references/`, or `assets/`) are loaded only when required

Keep your main `SKILL.md` under 500 lines. Move detailed reference material to separate files.

## File references

When referencing other files in your skill, use relative paths from the skill root:

```markdown  theme={null}
See [the reference guide](references/REFERENCE.md) for details.

Run the extraction script:
scripts/extract.py
```

Keep file references one level deep from `SKILL.md`. Avoid deeply nested reference chains.

## Validation

Use the [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref) reference library to validate your skills:

```bash  theme={null}
skills-ref validate ./my-skill
```

This checks that your `SKILL.md` frontmatter is valid and follows all naming conventions.

> ## Documentation Index
> Fetch the complete documentation index at: https://agentskills.io/llms.txt
> Use this file to discover all available pages before exploring further.

# Integrate skills into your agent

> How to add Agent Skills support to your agent or tool.

This guide explains how to add skills support to an AI agent or development tool.

## Integration approaches

The two main approaches to integrating skills are:

**Filesystem-based agents** operate within a computer environment (bash/unix) and represent the most capable option. Skills are activated when models issue shell commands like `cat /path/to/my-skill/SKILL.md`. Bundled resources are accessed through shell commands.

**Tool-based agents** function without a dedicated computer environment. Instead, they implement tools allowing models to trigger skills and access bundled assets. The specific tool implementation is up to the developer.

## Overview

A skills-compatible agent needs to:

1. **Discover** skills in configured directories
2. **Load metadata** (name and description) at startup
3. **Match** user tasks to relevant skills
4. **Activate** skills by loading full instructions
5. **Execute** scripts and access resources as needed

## Skill discovery

Skills are folders containing a `SKILL.md` file. Your agent should scan configured directories for valid skills.

## Loading metadata

At startup, parse only the frontmatter of each `SKILL.md` file. This keeps initial context usage low.

### Parsing frontmatter

```
function parseMetadata(skillPath):
    content = readFile(skillPath + "/SKILL.md")
    frontmatter = extractYAMLFrontmatter(content)

    return {
        name: frontmatter.name,
        description: frontmatter.description,
        path: skillPath
    }
```

### Injecting into context

Include skill metadata in the system prompt so the model knows what skills are available.

Follow your platform's guidance for system prompt updates. For example, for Claude models, the recommended format uses XML:

```xml  theme={null}
<available_skills>
  <skill>
    <name>pdf-processing</name>
    <description>Extracts text and tables from PDF files, fills forms, merges documents.</description>
    <location>/path/to/skills/pdf-processing/SKILL.md</location>
  </skill>
  <skill>
    <name>data-analysis</name>
    <description>Analyzes datasets, generates charts, and creates summary reports.</description>
    <location>/path/to/skills/data-analysis/SKILL.md</location>
  </skill>
</available_skills>
```

For filesystem-based agents, include the `location` field with the absolute path to the SKILL.md file. For tool-based agents, the location can be omitted.

Keep metadata concise. Each skill should add roughly 50-100 tokens to the context.

## Security considerations

Script execution introduces security risks. Consider:

* **Sandboxing**: Run scripts in isolated environments
* **Allowlisting**: Only execute scripts from trusted skills
* **Confirmation**: Ask users before running potentially dangerous operations
* **Logging**: Record all script executions for auditing

## Reference implementation

The [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref) library provides Python utilities and a CLI for working with skills.

For example:

**Validate a skill directory:**

```
skills-ref validate <path>
```

**Generate `<available_skills>` XML for agent prompts:**

```
skills-ref to-prompt <path>...
```

Use the library source code as a reference implementation.
