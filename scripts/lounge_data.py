"""Copies what a browser cannot read from RR Lounge into data/lounge-<ladder>.json.

RR Lounge's leaderboard API (which the overlay reads live) allows browsers but has no country or division. Those are
only in the leaderboard web page, which browsers may not read from another site. This script (run by a GitHub Action
every 30 minutes) reads that page and keeps, per ladder, the rank tiers and each player's country.
"""

import json
import pathlib
import urllib.request

LADDERS = ["rr", "ct", "tt"]
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "data"


def page(ladder: str) -> str:
    request = urllib.request.Request(
        f"https://rr-lounge.com/leaderboard?category={ladder}",
        headers={"User-Agent": "rewind-overlay data job"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def array_after(html: str, marker: str) -> list:
    """The JSON array right after the marker. The page keeps its data as escaped JSON inside a script."""
    text = html.replace('\\"', '"')
    start = text.find(marker)
    if start < 0:
        return []
    start = text.index("[", start)
    depth, quoted, i = 0, False, start
    while i < len(text):
        c = text[i]
        if quoted:
            if c == "\\":
                i += 1
            elif c == '"':
                quoted = False
        elif c == '"':
            quoted = True
        elif c in "[{":
            depth += 1
        elif c in "]}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    return []
        i += 1
    return []


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for ladder in LADDERS:
        try:
            html = page(ladder)
        except Exception as error:  # Keep the last file when the site is down.
            print(f"{ladder}: not read ({error})")
            continue
        tiers = [
            {"name": t.get("name"), "minMmr": t.get("minMmr", 0), "color": t.get("color"), "icon": t.get("icon")}
            for t in array_after(html, '"rankTiers":[')
        ]
        players = array_after(html, '"players":[{"id"')
        countries = {p["id"]: p["countryCode"].lower() for p in players if p.get("id") and p.get("countryCode")}
        if not tiers and not countries:
            print(f"{ladder}: page changed shape, file kept")
            continue
        data = {"tiers": tiers, "countries": countries}
        (OUT / f"lounge-{ladder}.json").write_text(json.dumps(data, separators=(",", ":"), sort_keys=True) + "\n")
        print(f"{ladder}: {len(tiers)} tiers, {len(countries)} countries")


if __name__ == "__main__":
    main()
