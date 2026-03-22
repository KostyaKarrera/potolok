# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack monolithic web application for a ceiling installation business (натяжные потолки). Includes a customer-facing site, interactive price constructor, admin panel, and partner referral system. Content is in Russian.

## Commands

- **Start server:** `npm start` (runs `node server.js`)
- **Build for production:** `npm run build` (orchestrates minification via `scripts/build.js`)
- **Minify CSS/JS:** `npm run minify` (PostCSS + cssnano for CSS, Terser for JS)
- **Download fonts:** `npm run download-fonts`
- **Generate custom Font Awesome:** `npm run generate-fa`
- **No tests configured.**

## Architecture

```
Browser (Vanilla JS + Service Worker)
    ↓
Express.js 5 Server (ES Modules)
    ├── REST API (/api/*)
    ├── Static file serving (public/)
    ├── JWT + Bcrypt auth
    └── Telegram bot notifications
    ↓
SQLite (database.db)
```

### Backend (`server.js`, `database.js`)

Single-file Express server (~51KB). Handles 38+ API routes, static file serving with tiered caching (HTML 1hr, assets 1yr immutable, SW no-cache), rate limiting (30 req/60s), CSP headers, and Telegram bot integration for request notifications.

**Database tables:** `partners`, `requests`, `contracts`, `phone_clicks`, `settings` — all initialized in `database.js`.

### Frontend (`public/`)

Vanilla JS with no framework. Key files:
- `js/main.js` — main site logic (phone masks, modals, gallery, lazy loading, Service Worker registration)
- `js/constructor.js` — interactive price calculator fetching from `/api/prices` and `/api/products`
- `css/style.css` → `css/style.min.css` (minified via build)
- `sw.js` — Service Worker v1.1.0: Network First for HTML/images, Cache First for static assets

### Pages

Multi-page app with separate HTML files per route:
- `/` — homepage (`public/index.html`)
- `/ready-solutions/` — package deals
- `/constructor/` — interactive price calculator
- `/admin/` — admin dashboard (request/contract/pricing management)
- `/partners/` — partner login + dashboard with referral tracking
- City-specific landing pages: `/cheboksary/`, `/novocheboksarsk/`, `/yoshkar-ola/`

### Data (`data/`)

- `products.json` — room type configurations
- `prices.json` — fabric, lighting, curtain pricing (also editable via admin API)

### Build Scripts (`scripts/`)

- `build.js` — production build orchestrator
- `minify.js` — CSS (PostCSS/cssnano) and JS (Terser) minification
- `deploy.js` — automated deployment
- `optimize-images.sh` — image optimization (requires external tools)

## Key Patterns

- ES Modules throughout (`"type": "module"` in package.json)
- Minified files live alongside sources (`style.css` → `style.min.css`, `main.js` → `main.min.js`)
- HTML pages use inline critical CSS, async CSS loading (`media="print"` technique), and resource hints
- Google Maps loaded lazily via IntersectionObserver
- Partner referral system uses `?ref=` URL parameter tracked through to contracts
