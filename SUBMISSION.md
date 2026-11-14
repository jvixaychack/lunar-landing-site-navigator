# NASA Space Apps Challenge Submission Package

---

## 1. Space Apps Portal — Project Description (Copy-Paste Ready)

**Project Name:** Lunar South Pole Navigator

**High-Level Summary:**
Lunar South Pole Navigator is an interactive, zero-backend mission-planning and science-communication web application that visualizes solar illumination, terrain shadowing, and Direct-to-Earth (DTE) communications across five Artemis III candidate landing sites at the Lunar South Pole.

**Detailed Project Description:**
At the Lunar South Pole, the Moon's 1.54° axial tilt causes the Sun to skim near the horizon year-round. While elevated crater rims receive prolonged sunlight ideal for solar power, nearby crater floors only kilometers away remain in permanent shadow, preserving ancient water-ice deposits while posing extreme thermal and power challenges.

**Lunar South Pole Navigator** transforms raw NASA planetary datasets into an intuitive, browser-based decision-support and educational tool:

1. **True Polar Stereographic Mapping (`IAU2000:30120`):** Built with OpenLayers and `proj4`, the interactive map streams live **ASU / LROC Lunaserv WMS** imagery (LROC WAC and LOLA shaded-relief elevation) with an automatic offline LOLA fallback, plotting five Artemis III candidate sites (**Shackleton Rim**, **Malapert Massif**, **Nobile Rim 1**, **Connecting Ridge**, **Peak Near Shackleton**) plus a **Deep Crater Floor** comparison point ~5 km from Shackleton Rim.
2. **Ray-Traced 360° Horizon Masks & JPL Horizons Ephemeris:** Using the **NASA LRO LOLA 80 m/pixel South Pole DEM (`LDEM_80S_80M.IMG`)**, we ray-traced 1°-resolution 360° terrain horizon profiles (accounting for lunar spherical curvature and a 2.0 m surface mast height) and combined them with hourly **NASA JPL Horizons (DE441)** Sun and Earth topocentric azimuth/elevation series across three 30-day (720-hour) seasonal windows aligned with the Moon's draconic year (**Summer Solstice 2026**, **Equinox 2027**, and **Winter Solstice 2027**).
3. **Three Purpose-Built Modes:**
   - **Planner Mode:** Displays engineering KPIs—Solar Power Availability %, Longest Continuous Sunlight Window, Direct-to-Earth Comms Uptime %, and horizon clearances—alongside a live 360° Polar Horizon Sky Plot showing the Sun's path and Earth's lunar libration figure-8 track.
   - **Explorer (Educator) Mode:** Translates complex orbital mechanics into plain-language callouts for students, educators, and the public.
   - **Compare Mode:** Contrasts **Shackleton Rim** against the adjacent **Deep Crater Floor** side by side to demonstrate how ~3 km of elevation difference creates dramatic illumination and communications disparities.

Because all ephemeris and horizon masks are precomputed into a static JSON dataset (`public/data/sites.json`), the application deploys cleanly to Vercel or GitHub Pages with zero backend infrastructure.

---

## 2. 7-Slide Pitch Deck Outline (Aligned to All 5 Judging Criteria)

> **Judging Criteria Coverage:** Impact · Creativity · Validity · Relevance · Presentation

- **Slide 1 — Title & Mission Hook *(Presentation, Relevance)***
  - **Headline:** *Lunar South Pole Navigator: Illuminating Artemis III Landing Sites*
  - **Visual:** Full-screen capture of the dark-mode South Pole Stereographic map (`IAU2000:30120`) with glowing candidate site markers.
  - **Key Point:** Returning humans to the Lunar South Pole requires balancing two competing imperatives: sunlit ridges for power and permanently shadowed craters for water ice.

- **Slide 2 — The Problem & Why It Matters *(Impact, Relevance)***
  - **Headline:** *5 Kilometers Apart, Worlds Apart in Sunlight & Comms*
  - **Visual:** Compare Mode screenshot contrasting **Shackleton Rim** (+1,736.5 m) vs. **Deep Crater Floor** (-1,355.5 m).
  - **Key Point:** Existing planetary GIS tools are steep for students and rapid mission trade studies. Teams and educators lack a fast, accessible way to inspect hourly Sun/Earth visibility against real lunar terrain across seasons.

- **Slide 3 — Solution & Creative Dual-Audience Design *(Creativity, Presentation)***
  - **Headline:** *One Scientific Engine, Three Tailored Experiences*
  - **Visual:** Split-panel showing **Planner Mode** (KPIs + 360° Polar Horizon Sky Plot), **Explorer (Educator) Mode** (guided callouts), and **Compare Mode**.
  - **Key Point:** Combines an engineering-grade polar sky plot—where Earth traces a lunar libration figure-8 above the terrain mask—with an approachable Educator mode and interactive 720-hour timeline scrubber.

- **Slide 4 — Scientific Validity & NASA Data Pipeline *(Validity)***
  - **Headline:** *Grounded in LRO LOLA, JPL Horizons DE441, and Lunaserv WMS*
  - **Visual:** Architecture diagram: `LDEM_80S_80M.IMG` (80 m/px DEM) + JPL Horizons (`MEAN_ME`, airless) → `scripts/generate_lunar_data.py` → `sites.json` → Static React/OpenLayers SPA.
  - **Key Point:** 360° horizon masks are ray-traced at 1° resolution with lunar spherical curvature (`R = 1,737.4 km`, 2.0 m mast height); seasons follow the Moon's ~346.6-day draconic year; validated by automated `pytest` checks.

- **Slide 5 — Live Product Walkthrough *(Presentation, Validity)***
  - **Headline:** *Interactive 720-Hour Seasonal Exploration*
  - **Visual:** Annotated UI callout of the 360° Polar Horizon Sky Plot, KPI cards (Solar Power Availability %, DTE Comms Uptime %), and `1x/2x/4x` timeline playback.
  - **Key Point:** Users can scrub hour-by-hour through Summer Solstice 2026, Equinox 2027, and Winter Solstice 2027 to watch Sun and Earth rise and dip behind crater rims in real time.

- **Slide 6 — Impact & Zero-Backend Accessibility *(Impact, Creativity)***
  - **Headline:** *Built for Mission Planners, Classrooms, and Global Access*
  - **Visual:** Deployment badges (Vercel & GitHub Pages) + offline LOLA fallback preview.
  - **Key Point:** Zero backend dependencies and automatic offline basemap fallback mean the app runs reliably in classrooms, museums, and low-bandwidth environments worldwide under an Apache 2.0 open-source license.

- **Slide 7 — Roadmap & Call to Action *(Impact, Relevance)***
  - **Headline:** *Next Steps Toward Lunar Surface Operations*
  - **Visual:** Future milestones: custom rover traverse pathing, thermal/shadowing heatmaps, and multi-relay lunar communications modeling.
  - **Key Point:** Try the live app, explore the open-source repository, and inspect every dataset citation directly in-app.

---

## 3. 30-Second Demo Video Script (with Visual Cues)

| Time | Visual Cue | Voiceover / Narration |
| :--- | :--- | :--- |
| **0:00 – 0:05** | **Wide shot of app in Planner Mode.** Cursor hovers over the South Pole Stereographic map (`IAU2000:30120`) showing LROC WAC imagery and the 5 Artemis III candidate sites. | *"To survive at the Lunar South Pole, Artemis missions need sunlight for power and line-of-sight to Earth for communications. Meet Lunar South Pole Navigator."* |
| **0:05 – 0:12** | **Click `Shackleton Rim` on the map.** Right panel updates KPIs and the 360° Polar Horizon Sky Plot. Hit **Play (`4x`)** on the 720-hour timeline scrubber. | *"Powered by NASA LRO LOLA 80-meter topography and JPL Horizons DE441 ephemeris, you can scrub through 720-hour lunar seasons and watch the Sun skim the horizon while Earth traces its libration figure-8."* |
| **0:12 – 0:20** | **Switch header toggle to `Compare` mode.** Highlight **Shackleton Rim** vs. **Deep Crater Floor** (~5 km away) side by side. | *"Just five kilometers away, a deep crater floor plunges into permanent shadow—instantly showing why meter-scale terrain dictates mission survival."* |
| **0:20 – 0:26** | **Switch header toggle to `Explorer (Educator)` mode**, then briefly open the **Data & Citations** modal. | *"Switch to Explorer mode for classroom-ready explanations, backed by transparent, verifiable NASA data citations."* |
| **0:26 – 0:30** | **Zoom out to full dashboard with title overlay & Apache 2.0 / GitHub Pages badge.** | *"Zero backend, open source, and ready to explore the Moon's South Pole today."* |

---

## 4. Mandatory AI Usage Disclosure

In accordance with NASA Space Apps Challenge rules regarding the use of Artificial Intelligence tools:

- **AI Tools & Models Used:** **Google Antigravity** powered by **Gemini 4 Hydrogen**.
- **Scope of AI Assistance:**
  - Assisted with frontend UI/UX scaffolding (React, TypeScript, Tailwind CSS, OpenLayers `IAU2000:30120` projection setup, and 360° Polar Horizon Sky Plot SVG rendering).
  - Assisted with structuring the offline Python data-generation pipeline (`scripts/generate_lunar_data.py`), automated `pytest` validation (`tests/test_lunar_data.py`), static deployment configurations (`vercel.json`, `.github/workflows/deploy.yml`), and repository documentation (`README.md`, `SUBMISSION.md`).
- **Human Verification & Scientific Responsibility:**
  - All NASA dataset integrations (LRO LOLA `LDEM_80S_80M.IMG` horizon ray-tracing, ASU/LROC Lunaserv WMS, and JPL Horizons DE441 ephemeris), coordinate frame conventions (`MEAN_ME`, `IAU2000:30120`), astronomical calculations, build outputs, and test results were reviewed, executed, and verified by the project team.
