# Enact Web - Registry Browser & Auth Portal

A web application for browsing, discovering, and inspecting Enact tools. Also serves as the OAuth authentication portal for the CLI.

## Overview

The web app provides a visual interface to the Enact registry, allowing users to:
- Browse and search for tools
- View tool details, manifests, and source code
- See trust/attestation status
- Copy install commands
- **Authenticate CLI sessions** via OAuth (GitHub, Google)

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Framework** | React 18 + Vite | Fast dev, great DX, TypeScript support |
| **Routing** | React Router v6 | Standard, file-based routing possible |
| **Styling** | Tailwind CSS | Utility-first, fast iteration |
| **Code Highlighting** | Shiki | VS Code themes, lightweight, SSR-ready |
| **Data Fetching** | TanStack Query | Caching, refetching, optimistic updates |
| **API Client** | Browser-native (lib/api-client.ts) | Self-contained, no Node.js deps |
| **Icons** | Lucide React | Consistent, tree-shakeable |

## Architecture

```
packages/web/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Layout.tsx
│   │   │   └── UserMenu.tsx         # User avatar & dropdown menu
│   │   ├── tools/
│   │   │   ├── ToolCard.tsx
│   │   │   ├── ToolGrid.tsx
│   │   │   ├── ToolDetail.tsx
│   │   │   └── ToolManifest.tsx
│   │   ├── code/
│   │   │   ├── CodeBrowser.tsx      # File tree + viewer
│   │   │   ├── CodeViewer.tsx       # Shiki syntax highlighting
│   │   │   └── FileTree.tsx         # Collapsible file list
│   │   ├── trust/
│   │   │   ├── AttestationBadge.tsx
│   │   │   ├── TrustStatus.tsx
│   │   │   └── RekorLink.tsx
│   │   └── ui/
│   │       ├── SearchBar.tsx
│   │       ├── CopyButton.tsx
│   │       ├── Badge.tsx
│   │       └── Spinner.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx          # Auth state, profile, username
│   ├── pages/
│   │   ├── Home.tsx                 # Landing + search
│   │   ├── Browse.tsx               # Tool listing with filters
│   │   ├── Tool.tsx                 # Tool detail page
│   │   ├── ToolCode.tsx             # Code browser for a tool
│   │   ├── NotFound.tsx
│   │   └── auth/
│   │       ├── Login.tsx            # Web login/signup page
│   │       ├── AuthCallback.tsx     # OAuth callback for web
│   │       ├── ChooseUsername.tsx   # Username selection
│   │       ├── CliAuth.tsx          # CLI OAuth start
│   │       ├── CliCallback.tsx      # CLI OAuth callback
│   │       └── CliSuccess.tsx       # CLI success message
│   ├── hooks/
│   │   ├── useTools.ts              # TanStack Query hooks
│   │   ├── useToolCode.ts           # Fetch tool files
│   │   └── useSearch.ts
│   ├── lib/
│   │   ├── api.ts                   # API client wrapper
│   │   ├── supabase.ts              # Supabase client
│   │   ├── shiki.ts                 # Shiki highlighter setup
│   │   └── utils.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                    # Tailwind imports
├── public/
│   └── favicon.svg
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Pages

### 1. Home (`/`)
- Hero section with search bar
- Featured/popular tools
- Quick stats (total tools, downloads)

### 2. Browse (`/browse`)
- Search bar (persisted in URL)
- Filter sidebar: tags, license, has attestations
- Sort: downloads, newest, alphabetical
- Paginated tool grid

### 3. Tool Detail (`/tools/:owner/:name`)
- Tool header: name, description, version, downloads
- Trust section: attestations, Rekor links
- Manifest view: inputs, outputs, container config
- README preview
- Install command with copy button
- Version selector dropdown
- Link to code browser

### 4. Code Browser (`/tools/:owner/:name/code`)
- File tree sidebar (collapsible)
- Shiki-highlighted code viewer
- Line numbers
- File path breadcrumb
- Raw file download link

### 5. CLI Auth (`/auth/cli`)
- OAuth callback page for CLI authentication
- Shows "Login successful, return to terminal" message
- Handles token exchange with CLI

## CLI Authentication Flow

The web app serves as the OAuth portal for `enact auth login`:

```
┌──────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐
│ CLI  │       │  Web App │       │ Supabase │       │  GitHub  │
└──┬───┘       └────┬─────┘       └────┬─────┘       └────┬─────┘
   │                │                  │                  │
   │ enact auth     │                  │                  │
   │ login          │                  │                  │
   │────────────────│                  │                  │
   │                │                  │                  │
   │ Start local    │                  │                  │
   │ server :8118   │                  │                  │
   │                │                  │                  │
   │ Open browser   │                  │                  │
   │ enact.tools/   │                  │                  │
   │ auth/cli?port= │                  │                  │
   │ 8118           │                  │                  │
   │───────────────▶│                  │                  │
   │                │                  │                  │
   │                │ Redirect to      │                  │
   │                │ Supabase OAuth   │                  │
   │                │─────────────────▶│                  │
   │                │                  │                  │
   │                │                  │ Redirect to      │
   │                │                  │ GitHub           │
   │                │                  │─────────────────▶│
   │                │                  │                  │
   │                │                  │                  │ User approves
   │                │                  │                  │
   │                │                  │◀─────────────────│
   │                │                  │                  │
   │                │◀─────────────────│                  │
   │                │ (with tokens)    │                  │
   │                │                  │                  │
   │                │ POST to CLI      │                  │
   │                │ localhost:8118   │                  │
   │◀───────────────│ (with tokens)    │                  │
   │                │                  │                  │
   │ Store tokens   │                  │                  │
   │ in keyring     │                  │                  │
   │                │                  │                  │
   │ ✔ Logged in    │                  │                  │
   │ as @username   │                  │                  │
```

### Auth Pages

| Page | Purpose |
|------|---------|
| `/auth/cli` | CLI login landing, starts OAuth flow |
| `/auth/cli/callback` | OAuth callback, sends tokens to CLI |
| `/auth/cli/success` | Success message, "return to terminal" |
| `/login` | Web app login/signup (email, GitHub, Google) |
| `/auth/callback` | OAuth callback for web login |
| `/auth/choose-username` | Username selection for new OAuth users |

### Implementation

```typescript
// pages/auth/CliAuth.tsx
function CliAuth() {
  const searchParams = useSearchParams();
  const cliPort = searchParams.get('port') || '8118';
  
  // Store port in session, redirect to Supabase OAuth
  useEffect(() => {
    sessionStorage.setItem('cli_port', cliPort);
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=github&redirect_to=${window.location.origin}/auth/cli/callback`;
  }, []);
  
  return <div>Redirecting to GitHub...</div>;
}

// pages/auth/CliCallback.tsx  
function CliCallback() {
  const { session } = useSupabaseSession();
  const cliPort = sessionStorage.getItem('cli_port');
  
  useEffect(() => {
    if (session) {
      // Send tokens to CLI's local server
      fetch(`http://localhost:${cliPort}/callback`, {
        method: 'POST',
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          user: session.user,
        }),
      }).then(() => {
        window.location.href = '/auth/cli/success';
      });
    }
  }, [session]);
  
  return <div>Completing login...</div>;
}
```

## API Integration

Uses browser-native API client (`src/lib/api-client.ts`) to avoid Node.js dependencies:

```typescript
import { searchTools, getToolInfo, apiClient } from '@/lib/api';

// In React Query hook
const { data } = useQuery({
  queryKey: ['tools', 'search', query],
  queryFn: () => searchTools(apiClient, { query }),
});
```

## Code Browser Implementation

### File Tree
- Fetch file list from bundle metadata or dedicated endpoint
- Recursive tree component with expand/collapse
- Icons for file types (Python, JS, YAML, MD)

### Code Viewer with Shiki
```typescript
import { getHighlighter } from 'shiki';

const highlighter = await getHighlighter({
  themes: ['github-dark', 'github-light'],
  langs: ['python', 'javascript', 'typescript', 'yaml', 'markdown', 'json', 'bash'],
});

function CodeViewer({ code, lang }: { code: string; lang: string }) {
  const html = highlighter.codeToHtml(code, { lang, theme: 'github-dark' });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

## New API Endpoints Needed

| Endpoint | Purpose |
|----------|---------|
| `GET /tools/{name}/versions/{v}/files` | List files in bundle |
| `GET /tools/{name}/versions/{v}/files/{path}` | Get file content |

These could be served directly from R2/S3 if bundles are extracted, or computed on-demand.

## Deployment

### Option 1: Vercel (Recommended)
- Zero-config for Vite
- Edge functions for API proxying
- Preview deployments for PRs

### Option 2: Cloudflare Pages
- Pairs well with R2 storage
- Edge rendering

### Option 3: Static + CDN
- Build static files
- Deploy to any CDN (S3 + CloudFront, Netlify)

## Development Phases

### Phase 1: Core Browse Experience ✅
- [x] Project setup (Vite + React + Tailwind)
- [x] Home page with search
- [x] Browse page with tool grid
- [x] Tool detail page
- [x] Basic styling
- [x] CLI authentication portal

### Phase 2: Code Browser ✅
- [x] Shiki integration
- [x] File tree component
- [x] Code viewer with line numbers
- [x] File type icons

### Phase 3: Trust & Polish
- [ ] Attestation badges
- [ ] Rekor links
- [ ] Version selector
- [ ] Dark mode toggle
- [ ] Mobile responsive

### Phase 4: User Authentication ✅
- [x] User authentication (OAuth + email/password)
- [x] Modern Claude-inspired login UI
- [x] Username selection during signup
- [x] Username selection for OAuth users
- [x] Profile management with Supabase
- [x] CLI integration with web auth
- [x] User menu with avatar display
- [ ] Tool comparison
- [ ] Dependency graph visualization
- [ ] Search filters and facets

## Environment Variables

```env
VITE_API_URL=https://siikwkfgsmouioodghho.supabase.co/functions/v1
VITE_REKOR_URL=https://search.sigstore.dev
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

## Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "biome check src/",
    "typecheck": "tsc --noEmit"
  }
}
```
