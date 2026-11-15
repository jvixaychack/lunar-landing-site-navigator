# NASA Space Apps Challenge Submission Package

---

## 1. Space Apps Portal — Project Description (Copy-Paste Ready)

**Project Name:** Lunar South Pole Navigator

**High-Level Summary:**
Lunar South Pole Navigator is an interactive, static-first mission-planning and science-communication web application that visualizes lunar South Pole illumination, terrain shadowing, and geometric Earth line of sight to support Artemis IV planning. NASA describes Artemis IV as a planned 2028 crewed lunar South Pole landing ([NASA mission overview](https://www.nasa.gov/mission/artemis-iv/)), but has not announced the plotted coordinates as Artemis IV landing sites; they are illustrative study points.

**Detailed Project Description:**
At the Lunar South Pole, the Moon's approximately 1.54° axial tilt causes the Sun to skim near the horizon. Elevated crater rims can receive more sunlight than nearby crater floors, some of which are permanently shadowed regions that may preserve water ice. The application explores modeled illumination and terrain-clearance geometry; it does not estimate electrical power, thermal balance, or mission safety.

**Lunar South Pole Navigator** transforms raw NASA planetary datasets into an intuitive, browser-based decision-support and educational tool:

1. **True Polar Stereographic Mapping (`IAU2000:30120`):** Built with OpenLayers and `proj4`, the interactive map streams live **ASU / LROC Lunaserv WMS** imagery (LROC WAC and LOLA shaded-relief elevation) with an automatic offline LOLA fallback. It plots five illustrative South Pole study points (**Shackleton Rim**, **Malapert Massif**, **Nobile Rim 1**, **Connecting Ridge**, **Peak Near Shackleton**) plus a **Deep Crater Floor** comparison point ~5 km from Shackleton Rim; none is identified as a NASA-selected Artemis IV site.
2. **Ray-Traced 360° Horizon Masks & JPL Horizons Ephemeris:** Using the **NASA LRO LOLA 80 m/pixel South Pole DEM (`LDEM_80S_80M.IMG`)**, we ray-traced 1°-resolution 360° terrain horizon profiles (accounting for lunar spherical curvature and a 2.0 m observer height) and combined them with hourly **NASA JPL Horizons (DE441)** Sun and Earth topocentric azimuth/elevation series across three 30-day (720-hour) seasonal analysis windows near NASA's planned 2028 mission timeframe. The presets are not official mission dates.
3. **Three Purpose-Built Modes:**
   - **Planner Mode:** Displays geometric sunlight availability, longest continuous sunlight interval, geometric Earth line-of-sight visibility, and terrain clearances alongside a live 360° Polar Horizon Sky Plot. It does not calculate power generation, radio-link budgets, or network availability.
   - **Explorer (Educator) Mode:** Translates complex orbital mechanics into plain-language callouts for students, educators, and the public.
   - **Compare Mode:** Contrasts **Shackleton Rim** against the nearby **Deep Crater Floor** side by side to demonstrate how terrain and elevation affect modeled illumination and geometric Earth visibility.

Precomputed ephemeris and horizon masks (`public/data/sites.json`) let the application run on static hosting. Vercel also serves an optional JPL Horizons proxy for custom-date windows; static hosts without that endpoint use the documented analytical fallback.

---

## 2. 7-Slide Pitch Deck Outline (Aligned to All 5 Judging Criteria)

> **Judging Criteria Coverage:** Impact · Creativity · Validity · Relevance · Presentation

- **Slide 1 — Title & Mission Hook *(Presentation, Relevance)***
  - **Headline:** *Lunar South Pole Navigator: Supporting Artemis IV Planning*
  - **Visual:** Full-screen capture of the dark-mode South Pole Stereographic map (`IAU2000:30120`) with illustrative study-point markers.
  - **Key Point:** Artemis IV is planned as a crewed South Pole landing; this tool explores modeled lighting and terrain at illustrative locations, not official landing-site selections.

- **Slide 2 — The Problem & Why It Matters *(Impact, Relevance)***
  - **Headline:** *5 Kilometers Apart, Worlds Apart in Sunlight & Earth Visibility*
  - **Visual:** Compare Mode screenshot contrasting **Shackleton Rim** (+1,736.5 m) vs. **Deep Crater Floor** (-1,355.5 m).
  - **Key Point:** Existing planetary GIS tools are steep for students and rapid mission trade studies. Teams and educators lack a fast, accessible way to inspect hourly Sun/Earth visibility against real lunar terrain across seasons.

- **Slide 3 — Solution & Creative Dual-Audience Design *(Creativity, Presentation)***
  - **Headline:** *One Scientific Engine, Three Tailored Experiences*
  - **Visual:** Split-panel showing **Planner Mode** (KPIs + 360° Polar Horizon Sky Plot), **Explorer (Educator) Mode** (guided callouts), and **Compare Mode**.
  - **Key Point:** Combines an engineering-grade polar sky plot—where Earth traces a lunar libration figure-8 above the terrain mask—with an approachable Educator mode and interactive 720-hour timeline scrubber.

- **Slide 4 — Scientific Validity & NASA Data Pipeline *(Validity)***
  - **Headline:** *Grounded in LRO LOLA, JPL Horizons DE441, and Lunaserv WMS*
  - **Visual:** Architecture diagram: `LDEM_80S_80M.IMG` (80 m/px DEM) + JPL Horizons (`MEAN_ME`, airless) → `scripts/generate_lunar_data.py` → `sites.json` → Static React/OpenLayers SPA.
  - **Key Point:** 360° horizon masks are ray-traced at 1° resolution with lunar spherical curvature (`R = 1,737.4 km`, 2.0 m observer height). Seasonal presets are approximate 2028 study windows; all custom-date predictions are computed for the selected date and location.

- **Slide 5 — Live Product Walkthrough *(Presentation, Validity)***
  - **Headline:** *Interactive 720-Hour Seasonal Exploration*
  - **Visual:** Annotated UI callout of the 360° Polar Horizon Sky Plot, sunlight and Earth line-of-sight metrics, and `1x/2x/4x` timeline playback.
  - **Key Point:** Users can scrub hour-by-hour through three near-2028 lunar seasonal study windows to compare Sun and Earth visibility above local terrain.

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
| **0:00 – 0:05** | **Wide shot of app in Planner Mode.** Cursor hovers over the South Pole Stereographic map (`IAU2000:30120`) showing LROC WAC imagery and five illustrative study points. | *"Artemis IV is planned to return crews to the lunar South Pole. Explore how sunlight and terrain affect visibility at modeled locations with Lunar South Pole Navigator."* |
| **0:05 – 0:12** | **Click `Shackleton Rim` on the map.** Right panel updates modeled metrics and the 360° Polar Horizon Sky Plot. Hit **Play (`4x`)** on the 720-hour timeline scrubber. | *"Powered by NASA LRO LOLA topography and JPL Horizons ephemeris, explore seasonal sunlight and geometric Earth line of sight. These are study points, not selected landing sites."* |
| **0:12 – 0:20** | **Switch header toggle to `Compare` mode.** Highlight **Shackleton Rim** vs. **Deep Crater Floor** (~5 km away) side by side. | *"Just five kilometers away, the crater-floor model point receives no direct sunlight in this selected window, illustrating how terrain affects lunar surface conditions."* |
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
