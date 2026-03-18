# xmap

Visualize your web app's experience map. Install in your project, run one command, get an interactive canvas of every screen with live iframe previews.

Think Storybook for your app's navigation — every route rendered on a zoomable ReactFlow canvas with sections, edges, and a sidebar to navigate.

![xmap](https://github.com/user-attachments/assets/placeholder.png)

## Quick Start

```bash
# Install in your project
pnpm add -D xmap

# Run from your project root
npx xmap
```

That's it. xmap will:

1. Scan your codebase for routes (Next.js App Router + Pages Router)
2. Render every screen on a canvas with live iframes pointing at your dev server
3. Open `http://localhost:4200` in your browser

## Usage

```bash
# Default — assumes your app runs on localhost:3000
npx xmap

# Custom app URL
npx xmap http://localhost:8080

# Custom port for the xmap UI
npx xmap --port 5000

# Don't auto-open browser
npx xmap --no-open
```

## What You Get

- **Auto-discovered routes** — parses your `app/` or `pages/` directory, finds every page
- **Live iframe previews** — each screen card shows your actual running app
- **Sections** — routes auto-grouped by first path segment, color-coded
- **Edges** — navigation connections generated from route hierarchy
- **Entity pickers** — dynamic routes (`/clients/[id]`) get an input field to enter real IDs
- **Sidebar navigation** — zoom to sections, hide/show individual screens
- **Edge drawing** — drag between screen handles to create custom connections
- **Persistent state** — everything saves to `.xmap/map.json` in your project
- **Re-scan** — click "Re-scan routes" after adding new pages, keeps your customizations

## How It Works

```
your-project/
  app/                    ← xmap scans this
    dashboard/
      page.tsx            ← discovered as /dashboard
      clients/
        [id]/
          page.tsx        ← discovered as /dashboard/clients/[id]
    auth/
      page.tsx            ← discovered as /auth
  .xmap/
    map.json              ← xmap saves state here (auto-generated)
```

xmap reads your project structure at startup, builds an initial layout, then serves a pre-built React UI that loads your screens as iframes from your running dev server.

### Data Flow

```
Your app (localhost:3000)
        ↑ iframes
[xmap UI] (localhost:4200) ← reads .xmap/map.json
        ↑ served by
[xmap CLI] ← scans your app/ directory for routes
```

## Framework Support

| Framework | Status |
|-----------|--------|
| Next.js App Router | Supported |
| Next.js Pages Router | Supported |
| React Router | Planned |
| SvelteKit | Planned |
| Nuxt | Planned |

### Next.js Detection

- Scans `app/` and `src/app/` for `page.tsx` files (App Router)
- Scans `pages/` and `src/pages/` for route files (Pages Router)
- Handles dynamic segments `[param]`, catch-all `[...slug]`, optional catch-all `[[...slug]]`
- Strips route groups `(group)` from URLs
- Skips API routes, parallel routes (`@`), private folders (`_`)

## Configuration

xmap works without configuration. State is saved to `.xmap/map.json` and reloaded on subsequent runs.

Add `.xmap/` to your `.gitignore`:

```
# xmap
.xmap/
```

### Customizing the Map

The saved state in `.xmap/map.json` includes:

- Screen positions (col/row grid)
- Sections with labels and colors
- Edges between screens
- Workflows (screen sequences)
- Hidden screens
- Parameter values for dynamic routes
- Iframe dimensions

You can edit this file directly or use the UI to make changes — they auto-save.

## Development

```bash
# Clone the repo
git clone https://github.com/yourusername/xmap.git
cd xmap

# Install dependencies
pnpm install

# Build everything
pnpm build

# Link locally for testing
cd your-project
pnpm add -D /path/to/xmap
npx xmap
```

### Project Structure

```
xmap/
  src/
    cli/
      index.ts              # CLI entry — parses args, runs dev server
      commands/
        dev.ts              # Dev server — discovers routes, serves UI, API endpoints
      discovery/
        index.ts            # Framework detection
        nextjs.ts           # Next.js route parser (App Router + Pages Router)
    ui/
      App.tsx               # Root — loads state, auto-saves, WebSocket reload
      components/
        XmapCanvas.tsx      # ReactFlow canvas — sections, edges, interactions
        ScreenNode.tsx      # Screen card — iframe, entity picker, hover actions
        GroupNode.tsx        # Section background node
        XmapSidebar.tsx     # Sidebar — sections, screen toggles, workflows
      layout.ts             # buildGraph() — converts state to ReactFlow nodes/edges
      data-loader.ts        # API client (state, save, rediscover)
    shared/
      types.ts              # All TypeScript types (Screen, Section, Workflow, MapState)
```

### API Endpoints

The dev server exposes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/__xmap/api/state` | GET | Load current map state |
| `/__xmap/api/save` | POST | Save map state |
| `/__xmap/api/rediscover` | POST | Re-scan routes, merge with existing state |
| `/__xmap/ws` | WS | Live reload on `.xmap/` file changes |

## License

MIT
