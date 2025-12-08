# @enactprotocol/web Progress

## December 5, 2025

### Logo Updates
- Updated Header logo to use Terminal icon from lucide-react
- Updated Footer logo to use Terminal icon from lucide-react  
- Updated Home page hero to use `brand-logo.svg` with floating animation
- Added CSS animation keyframes for floating effect

### Tool Detail Page - GitHub-Style Redesign
- Redesigned Tool page to match GitHub repository layout
- **File Browser**: GitHub-style file list showing top-level files from the bundle
  - Folder icons (blue) for directories
  - File icons (gray) for files
  - File sizes displayed on the right
  - Clickable links to code browser
  - Dynamic fetching from `/tools/{name}/versions/{version}/files` API
  
- **Markdown Rendering**: Added support for rendering enact.md files
  - Installed `react-markdown` and `remark-gfm` for GitHub Flavored Markdown
  - Installed `@tailwindcss/typography` plugin for prose styling
  - Code blocks render with light background and dark text
  - Proper heading, link, and list styling
  - Falls back to raw text display for YAML files

- **Sidebar Reorganization**: Moved install/usage to compact sidebar
  - Details section (author, version, license)
  - Installation command (compact with copy button)
  - Usage command (compact with copy button)
  - Tags section

### New Example Tool
- Created `examples/data-pipeline` with complex folder structure for testing
  - Demonstrates nested directories: `src/extractors/`, `src/transformers/`, `src/loaders/`, `src/utils/`
  - Config files in `config/` directory
  - Test files in `tests/` directory
  - Uses `enact.md` format with YAML frontmatter
  - Published as `enact-examples/data-pipeline@1.0.0`

### Dependencies Added
- `react-markdown@10.1.0` - Markdown rendering
- `remark-gfm@4.0.1` - GitHub Flavored Markdown support
- `@tailwindcss/typography@0.5.19` - Prose styling for markdown content
