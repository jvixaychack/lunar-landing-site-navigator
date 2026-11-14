# Lunar South Pole Navigator

An interactive, zero-backend mission-planning and science-communication web application for exploring solar illumination, terrain shadowing, and Direct-to-Earth (DTE) communications across Artemis III candidate landing sites at the Lunar South Pole.

---

## Key Capabilities

- **South Pole Stereographic Map (`IAU2000:30120`)**
  - Powered by OpenLayers 10 and `proj4` in true Lunar South Pole Stereographic projection (`R = 1,737.4 km`, `80°S–90°S`).
  - Streams live **ASU / LROC Lunaserv WMS** basemaps (LROC Wide Angle Camera imagery and LOLA shaded-relief elevation) with an automatic offline LOLA fallback (`public/data/lola-south-pole-fallback.png`).
  - Displays 5 Artemis III candidate landing sites (**Shackleton Rim**, **Malapert Massif**, **Nobile Rim 1**, **Connecting Ridge**, **Peak Near Shackleton**) plus a **Deep Crater Floor** comparison point ~5 km from Shackleton Rim to illustrate extreme shadow contrast.
- **360° Polar Horizon Sky Plot**
  - Plots the ray-traced **LRO LOLA** 360° terrain horizon mask (1° azimuthal resolution, 2.0 m observer mast height, accounting for lunar spherical curvature) against hourly **Sun** paths and **Earth** libration figure-8 tracks.
- **720-Hour Seasonal Timeline Scrubber**
  - Scrub or play (`1x`, `2x`, `4x`) through three 30-day (720-hour) lunar seasonal windows aligned with the Moon's ~346.6-day draconic year:
    - **Summer Solstice 2026** (`2026-11-14` to `2026-12-13 UTC`)
    - **Equinox 2027** (`2027-01-27` to `2027-02-25 UTC`)
    - **Winter Solstice 2027** (`2027-04-10` to `2027-05-09 UTC`)
- **Three Tailored Modes**
  - **Planner**: Engineering KPIs (Solar Power Availability %, Longest Continuous Sunlight Window, Direct-to-Earth Comms Uptime %, Sun/Earth horizon clearances) and live sky plot.
  - **Explorer (Educator)**: Plain-language narrative callouts explaining why crater rims act as "peaks of eternal light" while adjacent crater floors remain permanently shadowed regions (PSRs).
  - **Compare**: Side-by-side seasonal comparison of **Shackleton Rim** vs. **Deep Crater Floor** across solar illumination, Earth visibility, and elevation.

---

## Architecture Notes

Lunar South Pole Navigator uses a **decoupled static-first architecture** with **zero backend dependencies** at runtime:

1. **Offline Scientific Data Pipeline (`scripts/generate_lunar_data.py`)**
   - Precomputes `public/data/sites.json` (~1.2 MB) containing 360° LRO LOLA terrain horizon masks and 720-hour Sun/Earth ephemeris series for all 6 sites across all 3 seasons.
   - **Topography**: Ray-traces 360° horizon elevation profiles up to 150 km from the LRO LOLA 80 m/pixel South Pole DEM (`LDEM_80S_80M.IMG`), with cached horizon masks stored in `scripts/lola_horizon_masks.json`.
   - **Ephemeris**: Queries the **NASA JPL Horizons API (DE441)** in the lunar `MEAN_ME` (Mean Earth / Polar Axis) frame with atmospheric refraction disabled (`AIRLESS`), and includes a deterministic analytical fallback (Meeus solar/lunar ephemeris + Cassini's Laws physical libration) when `--offline` is used or the API is unreachable.
2. **Static Frontend SPA (`src/`)**
   - Built with **React 19**, **TypeScript**, **Vite 7**, **Tailwind CSS v4**, **OpenLayers (`ol`)**, **proj4**, and **Lucide React**.
   - Loads `data/sites.json` via `import.meta.env.BASE_URL` so the static bundle runs identically from a root domain (Vercel) or a repository subpath (GitHub Pages).
   - No backend server, database, or API keys are required to build or host the web application.

### Repository Structure

```text
lunar-navigator/
├── .github/workflows/deploy.yml   # GitHub Pages static CI/CD workflow
├── public/data/
│   ├── sites.json                 # Precomputed ephemeris + LOLA horizon dataset
│   └── lola-south-pole-fallback.png
├── scripts/
│   ├── generate_lunar_data.py     # Offline LOLA + JPL Horizons data generator
│   └── lola_horizon_masks.json    # Cached 1°-resolution LOLA horizon masks
├── src/
│   ├── components/
│   │   ├── AnalyticalDashboard.tsx
│   │   ├── CompareView.tsx
│   │   ├── DataCitationsModal.tsx
│   │   ├── ExplorerCallouts.tsx
│   │   ├── KpiCards.tsx
│   │   ├── LunarSouthPoleMap.tsx
│   │   ├── PolarHorizonSkyPlot.tsx
│   │   └── TimelineScrubber.tsx
│   ├── types/lunar.ts
│   ├── utils/
│   │   ├── lunarAnalytics.ts
│   │   └── lunarProjection.ts
│   ├── App.tsx
│   └── main.tsx
├── tests/test_lunar_data.py       # Pytest validation for sites.json & ephemeris
├── vercel.json                    # Vercel static deployment config
├── vite.config.ts                 # Vite + chunk splitting config
└── package.json
```

---

## Local Setup Instructions

### Prerequisites

- **Node.js 20+** and **npm** (required for the web application)
- **Python 3.12+** (optional, only needed to regenerate `public/data/sites.json` or run Python data validation tests)

### 1. Run the Web Application

```bash
# Install frontend dependencies
npm install

# Start the local development server
npm run dev

# Type-check and build the production static bundle (outputs to dist/)
npm run build

# Preview the production build locally
npm run preview
```

### 2. Optional: Regenerate Data & Run Python Tests

```bash
# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Run the dataset validation test suite
pytest -q

# Regenerate public/data/sites.json using cached LOLA masks + offline ephemeris
python scripts/generate_lunar_data.py --offline

# Or query live NASA JPL Horizons DE441 ephemeris
python scripts/generate_lunar_data.py
```

---

## Deployment

This application builds to a pure static bundle (`dist/`) with zero backend dependencies.

- **Vercel**: Configured via `vercel.json` (`framework: "vite"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"`). Connect the repository to Vercel and deploy directly.
- **GitHub Pages**: Configured via `.github/workflows/deploy.yml`. Enable **Settings → Pages → Source: GitHub Actions** in your repository, then push to `main` (or trigger `workflow_dispatch`). The workflow builds with `--base=/${{ github.event.repository.name }}/` and publishes `dist/` automatically.

---

## NASA & Partner Dataset Attributions

1. **NASA LRO LOLA Topography (`LDEM_80S_80M.IMG`)**
   - 360° terrain horizon masks and site elevations are ray-traced from the **Lunar Reconnaissance Orbiter (LRO) Lunar Orbiter Laser Altimeter (LOLA)** South Pole 80 m/pixel Digital Elevation Model (`80°S–90°S`), referenced to a `1737.4 km` lunar sphere with a `2.0 m` surface observer mast height at `1°` azimuthal resolution.
   - *Credit: NASA Goddard Space Flight Center / LRO LOLA Science Team (PDS Geosciences Node).*

2. **ASU / LROC Lunaserv Web Map Service (WMS)**
   - Interactive South Pole basemap tiles are served via the **Arizona State University (ASU) / LROC Lunaserv WMS** (`https://wms.im-ldi.com/`, `https://lunaserv.lroc.asu.edu/`) in Lunar South Pole Stereographic projection (`IAU2000:30120`), providing LROC Wide Angle Camera (WAC) imagery and LOLA shaded-relief elevation layers.
   - *Credit: ASU School of Earth and Space Exploration / LROC Operations Center & NASA.*

3. **NASA JPL Horizons Ephemeris (DE441)**
   - Hourly Sun and Earth topocentric azimuth/elevation series (including Earth lunar libration figure-8 tracks for Direct-to-Earth communications) are computed from **NASA JPL Horizons (DE441)** (`https://ssd.jpl.nasa.gov/horizons/`) in the `MEAN_ME` (Mean Earth / Polar Axis) frame with atmospheric refraction disabled across 30-day seasonal mission windows.
   - *Credit: Jet Propulsion Laboratory, California Institute of Technology / NASA Solar System Dynamics.*

---

## License

Licensed under the [Apache License, Version 2.0](./LICENSE).
