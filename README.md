# hellotimber

Lachlan Heywood's portfolio — a working Nokia 3310 in your browser, built with
three.js / react-three-fiber and TanStack Start. The phone's menus _are_ the site:
every screen is a route, every route is a screen.

- **What & why:** [`VISION.md`](./VISION.md)
- **How to work here (humans and agents):** [`AGENTS.md`](./AGENTS.md)
- **Implementation plans:** [`docs/plans/`](./docs/plans/README.md)

## Quick start

```bash
mise install              # node 22 + the Vite+ CLI (.config/mise.toml)
mise exec -- vp install   # workspace dependencies
mise exec -- vp run dev   # website on http://localhost:3000
```

## Workspace

```
website/      TanStack Start app (composes everything)
packages/     standalone packages: phone-core, phone-screen, phone-3d, snake
```

`vp run ready` runs checks, tests, and builds across the workspace.
