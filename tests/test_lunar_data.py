"""Pytest verification suite for multi-season Lunar South Pole sites.json schema and physics bounds."""

from __future__ import annotations

import json
import math
import sys
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import generate_lunar_data as gld  # noqa: E402

SITES_JSON_PATH = REPO_ROOT / "public" / "data" / "sites.json"

EXPECTED_SITE_IDS = {
    "shackleton-rim",
    "malapert-massif",
    "nobile-rim-1",
    "connecting-ridge",
    "peak-near-shackleton",
    "deep-crater-floor",
}

EXPECTED_SEASON_IDS = ("south-pole-summer", "equinox", "south-pole-winter")


@pytest.fixture(scope="module")
def dataset() -> dict:
    assert SITES_JSON_PATH.exists(), f"Missing generated dataset at {SITES_JSON_PATH}"
    return json.loads(SITES_JSON_PATH.read_text(encoding="utf-8"))


def _ang_diff_deg(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return (a - b + 180.0) % 360.0 - 180.0


def test_metadata_and_seasons_schema(dataset: dict) -> None:
    meta = dataset["metadata"]
    assert meta["body"] == "Moon (301)"
    assert meta["referenceRadiusKm"] == pytest.approx(1737.4)
    assert meta["atmosphericRefraction"] is False
    assert meta["horizonMaskResolutionDeg"] == 1
    assert meta["observerHeightM"] == pytest.approx(2.0)
    assert meta["defaultSeason"] == "equinox"

    seasons = meta["seasons"]
    assert len(seasons) == 3
    assert tuple(s["id"] for s in seasons) == EXPECTED_SEASON_IDS

    expected_windows = {
        "south-pole-summer": ("2027-10-26T00:00:00Z", "2027-11-24T23:00:00Z"),
        "equinox": ("2028-01-08T00:00:00Z", "2028-02-06T23:00:00Z"),
        "south-pole-winter": ("2028-03-21T00:00:00Z", "2028-04-19T23:00:00Z"),
    }
    for season_meta in seasons:
        sid = season_meta["id"]
        tr = season_meta["timeRange"]
        assert (tr["start"], tr["end"]) == expected_windows[sid]
        assert tr["stepHours"] == 1
        assert tr["durationDays"] == 30
        assert tr["totalHours"] == 720


def test_sites_presence_and_coordinates(dataset: dict) -> None:
    sites = dataset["sites"]
    assert len(sites) == 6
    assert {s["id"] for s in sites} == EXPECTED_SITE_IDS

    by_id = {s["id"]: s for s in sites}
    for site in sites:
        coords = site["coordinates"]
        assert site["role"] in {"study", "comparison"}
        assert -90.0 <= coords["latitudeDeg"] <= -80.0
        assert 0.0 <= coords["longitudeDeg"] < 360.0
        assert -10_000.0 <= coords["elevationM"] <= 12_000.0
        assert coords["observerHeightM"] == pytest.approx(2.0)
        assert set(site["seasons"].keys()) == set(EXPECTED_SEASON_IDS)

    rim = by_id["shackleton-rim"]
    floor = by_id["deep-crater-floor"]
    assert floor["role"] == "comparison"
    assert floor["comparisonTargetId"] == "shackleton-rim"
    assert floor["comparisonDistanceKm"] == pytest.approx(5.0, abs=0.2)

    dist_km = gld.haversine_lunar_km(
        rim["coordinates"]["latitudeDeg"],
        rim["coordinates"]["longitudeDeg"],
        floor["coordinates"]["latitudeDeg"],
        floor["coordinates"]["longitudeDeg"],
    )
    assert 4.8 <= dist_km <= 5.2


def test_horizon_masks_and_hourly_schema_all_seasons(dataset: dict) -> None:
    season_starts = {
        s["id"]: datetime.strptime(s["timeRange"]["start"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        for s in dataset["metadata"]["seasons"]
    }

    for site in dataset["sites"]:
        mask = site["horizonMaskDeg"]
        assert isinstance(mask, list) and len(mask) == 360
        for deg_val in mask:
            assert math.isfinite(deg_val)
            assert -15.0 <= deg_val <= 60.0

        min_mask = min(mask)
        max_mask = max(mask)

        for sid in EXPECTED_SEASON_IDS:
            hourly = site["seasons"][sid]["hourly"]
            assert len(hourly) == 720
            t0 = season_starts[sid]

            for idx, row in enumerate(hourly):
                expected_ts = (t0 + timedelta(hours=idx)).strftime("%Y-%m-%dT%H:%M:%SZ")
                assert row["timestamp"] == expected_ts

                assert 0.0 <= row["sunAzimuthDeg"] < 360.0
                assert 0.0 <= row["earthAzimuthDeg"] < 360.0
                # Physical bounds for Lunar South Pole (lat <= -85 deg, obliquity 1.54 deg, orbit 5.14 deg)
                assert -10.0 <= row["sunElevationDeg"] <= 10.0
                assert -15.0 <= row["earthElevationDeg"] <= 15.0

                assert min_mask - 1e-4 <= row["sunHorizonMaskDeg"] <= max_mask + 1e-4
                assert min_mask - 1e-4 <= row["earthHorizonMaskDeg"] <= max_mask + 1e-4

                expected_s_mask = gld.interpolate_horizon_mask(mask, row["sunAzimuthDeg"])
                expected_e_mask = gld.interpolate_horizon_mask(mask, row["earthAzimuthDeg"])
                assert row["sunHorizonMaskDeg"] == pytest.approx(expected_s_mask, abs=1e-3)
                assert row["earthHorizonMaskDeg"] == pytest.approx(expected_e_mask, abs=1e-3)

                assert isinstance(row["sunVisible"], bool)
                assert isinstance(row["earthVisible"], bool)
                assert row["sunVisible"] == (row["sunElevationDeg"] > row["sunHorizonMaskDeg"])
                assert row["earthVisible"] == (row["earthElevationDeg"] > row["earthHorizonMaskDeg"])


def test_kpis_consistency_and_seasonal_extremes(dataset: dict) -> None:
    by_id = {s["id"]: s for s in dataset["sites"]}

    for site in dataset["sites"]:
        for sid in EXPECTED_SEASON_IDS:
            k = site["seasons"][sid]["kpis"]
            hourly = site["seasons"][sid]["hourly"]
            n = len(hourly)
            sun_vis = [r["sunVisible"] for r in hourly]
            earth_vis = [r["earthVisible"] for r in hourly]

            assert k["sunVisibleHours"] == sum(sun_vis)
            assert k["earthVisibleHours"] == sum(earth_vis)
            assert 0 <= k["continuousSunlightHours"] <= k["sunVisibleHours"] <= n
            assert k["continuousSunlightHours"] == gld.longest_true_run(sun_vis)

            assert 0.0 <= k["sunlightAvailabilityPct"] <= 100.0
            assert k["sunlightAvailabilityPct"] == pytest.approx(100.0 * sum(sun_vis) / n, abs=0.01)

            assert 0.0 <= k["earthLineOfSightPct"] <= 100.0
            assert k["earthLineOfSightPct"] == pytest.approx(100.0 * sum(earth_vis) / n, abs=0.01)

            assert k["minSunElevationDeg"] == pytest.approx(min(r["sunElevationDeg"] for r in hourly), abs=0.01)
            assert k["maxSunElevationDeg"] == pytest.approx(max(r["sunElevationDeg"] for r in hourly), abs=0.01)
            assert k["minEarthElevationDeg"] == pytest.approx(min(r["earthElevationDeg"] for r in hourly), abs=0.01)
            assert k["maxEarthElevationDeg"] == pytest.approx(max(r["earthElevationDeg"] for r in hourly), abs=0.01)

    # Study sites exhibit strict Summer > Equinox > Winter solar elevation and availability ordering
    for cid in ("shackleton-rim", "malapert-massif", "nobile-rim-1", "connecting-ridge", "peak-near-shackleton"):
        summer_k = by_id[cid]["seasons"]["south-pole-summer"]["kpis"]
        equinox_k = by_id[cid]["seasons"]["equinox"]["kpis"]
        winter_k = by_id[cid]["seasons"]["south-pole-winter"]["kpis"]

        assert summer_k["sunlightAvailabilityPct"] >= 75.0
        assert summer_k["sunlightAvailabilityPct"] > equinox_k["sunlightAvailabilityPct"] > winter_k["sunlightAvailabilityPct"]
        assert summer_k["maxSunElevationDeg"] > equinox_k["maxSunElevationDeg"] > winter_k["maxSunElevationDeg"]
        assert summer_k["earthLineOfSightPct"] >= 40.0
        assert winter_k["earthLineOfSightPct"] >= 50.0

    # Deep Crater Floor receives no direct sunlight in all 3 sampled windows
    for sid in EXPECTED_SEASON_IDS:
        fk = by_id["deep-crater-floor"]["seasons"][sid]["kpis"]
        assert fk["minHorizonMaskDeg"] > 5.0
        assert fk["maxHorizonMaskDeg"] > 20.0
        assert fk["sunlightAvailabilityPct"] == 0.0
        assert fk["continuousSunlightHours"] == 0
        assert fk["earthLineOfSightPct"] == 0.0


def test_offline_ephemeris_determinism_and_accuracy_all_seasons(dataset: dict) -> None:
    site = next(s for s in dataset["sites"] if s["id"] == "shackleton-rim")
    coords = site["coordinates"]
    alt_km = (coords["elevationM"] + coords["observerHeightM"]) / 1000.0

    for season in gld.SEASONS:
        timestamps = gld.build_hourly_timestamps(season.start_utc, season.end_utc)
        res1 = gld.compute_offline_ephemeris(timestamps, coords["latitudeDeg"], coords["longitudeDeg"], alt_km)
        res2 = gld.compute_offline_ephemeris(timestamps, coords["latitudeDeg"], coords["longitudeDeg"], alt_km)

        for arr1, arr2 in zip(res1[0] + res1[1], res2[0] + res2[1]):
            np.testing.assert_array_equal(arr1, arr2)

        (s_az_off, s_el_off), (e_az_off, e_el_off) = res1
        hourly = site["seasons"][season.id]["hourly"]
        s_az_ref = np.array([r["sunAzimuthDeg"] for r in hourly])
        s_el_ref = np.array([r["sunElevationDeg"] for r in hourly])
        e_az_ref = np.array([r["earthAzimuthDeg"] for r in hourly])
        e_el_ref = np.array([r["earthElevationDeg"] for r in hourly])

        assert np.sqrt(np.mean(_ang_diff_deg(s_az_off, s_az_ref) ** 2)) < 0.05
        assert np.sqrt(np.mean((s_el_off - s_el_ref) ** 2)) < 0.05
        assert np.sqrt(np.mean(_ang_diff_deg(e_az_off, e_az_ref) ** 2)) < 0.05
        assert np.sqrt(np.mean((e_el_off - e_el_ref) ** 2)) < 0.05


def test_horizons_unreachable_triggers_offline_fallback(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    def _fail_urlopen(*args, **kwargs):
        raise urllib.error.URLError("Simulated network outage")

    monkeypatch.setattr(gld.urllib.request, "urlopen", _fail_urlopen)

    out_path = tmp_path / "sites_offline.json"
    offline_data = gld.generate_dataset(output_path=out_path, use_offline=False)
    assert out_path.exists()
    assert "Offline Lunar Ephemeris" in offline_data["metadata"]["ephemerisSource"]
    assert len(offline_data["metadata"]["seasons"]) == 3
    assert len(offline_data["sites"]) == 6
    for sid in EXPECTED_SEASON_IDS:
        assert len(offline_data["sites"][0]["seasons"][sid]["hourly"]) == 720


def test_synthetic_dem_horizon_mask_physics() -> None:
    flat_dem = np.zeros((gld.LOLA_DEM_SIZE, gld.LOLA_DEM_SIZE), dtype=np.int16)
    surf_h, flat_mask = gld.compute_horizon_mask_from_dem(flat_dem, -89.5, 0.0, observer_height_m=2.0)
    assert surf_h == pytest.approx(0.0)
    for val in flat_mask:
        assert -0.25 <= val <= -0.05

    wall_dem = np.zeros((gld.LOLA_DEM_SIZE, gld.LOLA_DEM_SIZE), dtype=np.int16)
    yy, xx = np.ogrid[: gld.LOLA_DEM_SIZE, : gld.LOLA_DEM_SIZE]
    dist_m = np.hypot((xx - gld.LOLA_CENTER_OFFSET) * gld.LOLA_SCALE_M, (gld.LOLA_CENTER_OFFSET - yy) * gld.LOLA_SCALE_M)
    wall_dem[(dist_m >= 4800.0) & (dist_m <= 5200.0)] = 6000
    _, wall_mask = gld.compute_horizon_mask_from_dem(wall_dem, -90.0, 0.0, observer_height_m=2.0, max_dist_km=10.0)
    expected_elev = math.degrees(math.atan2(3000.0, 5000.0))
    assert min(wall_mask) >= expected_elev - 2.0
    assert max(wall_mask) <= expected_elev + 2.0
