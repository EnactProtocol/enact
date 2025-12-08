# @enactprotocol/web

Enact Registry Browser & Auth Portal - Web application for browsing, discovering, and inspecting Enact tools. Also serves as the OAuth authentication portal for the CLI.

## Features

### Phase 1: Core Browse + CLI Auth ✅

- **Home Page**: Hero section with search, feature highlights, and quick start guide
- **Browse Tools**: Searchable tool grid with filtering
- **Tool Detail**: Comprehensive tool information with install commands
- **CLI Authentication Flow**: OAuth portal for `enact auth login`
  - `/auth/cli` - Start OAuth flow
  - `/auth/cli/callback` - Handle OAuth callback, send tokens to CLI
  - `/auth/cli/success` - Success message

### Phase 2: Code Browser (Planned)

- File tree navigation
- Shiki syntax highlighting
- Line numbers and breadcrumbs

### Phase 3: Trust & Polish (Planned)

- Attestation badges and trust status
- Version selector
- Dark mode toggle
- Mobile responsive design

## Tech Stack

- **Framework**: React 18 + Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **Code Highlighting**: Shiki
- **Data Fetching**: TanStack Query
- **API Client**: Browser-native (`src/lib/api-client.ts`)
- **Icons**: Lucide React

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Type check
bun run typecheck

# Lint
bun run lint
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_REKOR_URL=https://search.sigstore.dev
```

The API URL is automatically derived from `VITE_SUPABASE_URL` as `${VITE_SUPABASE_URL}/functions/v1`.

## CLI Authentication Flow

The web app serves as the OAuth portal for `enact auth login`:

1. CLI starts local server on port 8118
2. CLI opens browser to `/auth/cli?port=8118`
3. Web app redirects to Supabase OAuth (GitHub/Google)
4. User approves authentication
5. Callback page POSTs tokens to `localhost:8118`
6. CLI stores tokens in OS keyring
7. Success page confirms completion

## Project Structure

```
src/
├── components/
│   ├── layout/          # Header, Footer, Layout
│   ├── tools/           # ToolCard, ToolGrid
│   └── ui/              # SearchBar, CopyButton, Badge, Spinner
├── pages/
│   ├── Home.tsx         # Landing page
│   ├── Browse.tsx       # Tool listing
│   ├── Tool.tsx         # Tool detail
│   ├── ToolCode.tsx     # Code browser (Phase 2)
│   ├── NotFound.tsx     # 404 page
│   └── auth/
│       ├── CliAuth.tsx      # Start OAuth
│       ├── CliCallback.tsx  # Handle callback
│       └── CliSuccess.tsx   # Success message
├── lib/
│   ├── api.ts           # API client wrapper
│   └── utils.ts         # Utility functions
├── App.tsx
└── main.tsx
```

## Deployment

### Option 1: Vercel (Recommended)

```bash
vercel deploy
```

### Option 2: Cloudflare Pages

```bash
bun run build
# Deploy dist/ to Cloudflare Pages
```

### Option 3: Static Hosting

```bash
bun run build
# Deploy dist/ to any static host
```

## License

Part of the Enact project. See root LICENSE for details.
