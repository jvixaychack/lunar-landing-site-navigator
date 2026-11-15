# Lunar South Pole Navigator

An interactive, zero-backend mission-planning and science-communication web application for exploring lunar South Pole lighting, terrain shadowing, and geometric Earth visibility in support of Artemis IV planning.

NASA describes Artemis IV as a planned 2028 crewed lunar South Pole landing. NASA has not announced Artemis IV landing-site coordinates; the five plotted locations are illustrative study points, not officially selected candidate sites or certified landing locations. See NASA's [Artemis IV mission overview](https://www.nasa.gov/mission/artemis-iv/).

---

## Key Capabilities

- **South Pole Stereographic Map (`IAU2000:30120`)**
  - Powered by OpenLayers 10 and `proj4` in true Lunar South Pole Stereographic projection (`R = 1,737.4 km`, `80°S–90°S`).
  - Streams live **ASU / LROC Lunaserv WMS** basemaps (LROC Wide Angle Camera imagery and LOLA shaded-relief elevation) with an automatic offline LOLA fallback (`public/data/lola-south-pole-fallback.png`).
  - Displays 5 illustrative lunar South Pole study points (**Shackleton Rim**, **Malapert Massif**, **Nobile Rim 1**, **Connecting Ridge**, **Peak Near Shackleton**) plus a **Deep Crater Floor** comparison point ~5 km from Shackleton Rim. None is presented as an officially selected Artemis IV site.
- **360° Polar Horizon Sky Plot**
  - Plots the ray-traced **LRO LOLA** 360° terrain horizon mask (1° azimuthal resolution, 2.0 m observer mast height, accounting for lunar spherical curvature) against hourly **Sun** paths and **Earth** libration figure-8 tracks.
- **720-Hour Seasonal Timeline Scrubber**
  - Scrub or play (`1x`, `2x`, `4x`) through three 30-day (720-hour) lunar seasonal analysis windows near NASA's planned 2028 mission timeframe:
    - **South Pole Summer 2027** (`2027-10-26` to `2027-11-24 UTC`)
    - **Equinox 2028** (`2028-01-08` to `2028-02-06 UTC`)
    - **South Pole Winter 2028** (`2028-03-21` to `2028-04-19 UTC`)
  - These are approximate seasonal study windows, not Artemis IV launch, landing, or surface-operation dates. Use the date picker for other dates.
- **Three Tailored Modes**
  - **Planner**: Geometric sunlight availability, longest continuous sunlight interval, Earth line-of-sight visibility, terrain clearances, and a live sky plot. It does not estimate electrical power, radio link budgets, or network availability.
  - **Explorer (Educator)**: Plain-language explanations of how terrain affects sunlight and Earth visibility during the selected 30-day window. A short-window result does not establish permanent shadow or water ice.
  - **Compare**: Side-by-side seasonal comparison of **Shackleton Rim** vs. **Deep Crater Floor** across solar illumination, Earth visibility, and elevation.

---

## Architecture Notes

Lunar South Pole Navigator uses a **static-first architecture**:

1. **Offline Scientific Data Pipeline (`scripts/generate_lunar_data.py`)**
   - Precomputes `public/data/sites.json` containing 360° LRO LOLA terrain horizon masks and 720-hour Sun/Earth ephemeris series for five illustrative study points plus one comparison point across all 3 seasonal windows.
   - **Topography**: Ray-traces 360° horizon elevation profiles up to 150 km from the LRO LOLA 80 m/pixel South Pole DEM (`LDEM_80S_80M.IMG`), with cached horizon masks stored in `scripts/lola_horizon_masks.json`.
   - **Ephemeris**: Queries the **NASA JPL Horizons API (DE441)** in the lunar `MEAN_ME` (Mean Earth / Polar Axis) frame with atmospheric refraction disabled (`AIRLESS`), and includes a deterministic analytical fallback (Meeus solar/lunar ephemeris + Cassini's Laws physical libration) when `--offline` is used or the API is unreachable.
2. **Frontend SPA (`src/`)**
   - Built with **React 19**, **TypeScript**, **Vite 7**, **Tailwind CSS v4**, **OpenLayers (`ol`)**, **proj4**, and **Lucide React**.
   - Loads `data/sites.json` via `import.meta.env.BASE_URL` so the static bundle runs identically from a root domain (Vercel) or a repository subpath (GitHub Pages).
    - The precomputed dataset works on any static host. Custom-date windows request fresh JPL Horizons ephemerides through the optional Vercel serverless function (`api/ephemeris.js`); hosts without that endpoint use the deterministic analytical fallback. No API keys or database are required.

### Repository Structure

```text
lunar-navigator/
├── .github/workflows/deploy.yml   # GitHub Pages static CI/CD workflow
├── api/ephemeris.js               # Optional Vercel JPL Horizons proxy for custom dates
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

The application builds to a static bundle (`dist/`). Vercel additionally serves the optional JPL Horizons proxy for custom-date calculations; GitHub Pages uses the offline analytical fallback for those requests.

- **Vercel**: Configured via `vercel.json` (`framework: "vite"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"`); it also serves `api/ephemeris.js` for live JPL Horizons requests. Connect the repository to Vercel and deploy directly.
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
   - Hourly Sun and Earth topocentric azimuth/elevation series (including apparent Earth libration) are computed from **NASA JPL Horizons (DE441)** (`https://ssd.jpl.nasa.gov/horizons/`) in the `MEAN_ME` (Mean Earth / Polar Axis) frame with atmospheric refraction disabled across 30-day seasonal analysis windows. Earth visibility is geometric line of sight above the modeled terrain, not a radio-link or communications-availability prediction.
   - *Credit: Jet Propulsion Laboratory, California Institute of Technology / NASA Solar System Dynamics.*

4. **Artemis IV mission context**
   - NASA's [Artemis IV mission overview](https://www.nasa.gov/mission/artemis-iv/) describes a planned 2028 crewed surface landing near the lunar South Pole. NASA has not announced the plotted coordinates as Artemis IV landing sites; they are illustrative study locations for exploring relevant environmental conditions.

---

## License

Licensed under the [Apache License, Version 2.0](./LICENSE).
