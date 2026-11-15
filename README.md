# Overlay

A Retro Rewind VR and RR Lounge MMR overlay for OBS, a Retro Rewind music pack maker, and a common.szs editor. All run in
the browser. Nothing to download.

**Open it:** https://imlucaa.github.io/rewind-overlay/

## Overlay

1. Pick **Card**, **Slim** or **Race HUD**, then **VR** (friend code), **MMR** (RR Lounge name) or **LR** (MKW Lounge name).
2. Change the look; the preview updates as you go.
3. Click **Copy link** and paste it into an OBS **Browser** source (1920 × 1080).

Settings are kept in your browser and carried in the link.

## Music Pack

1. **Songs:** drop in MP3, WAV, OGG or FLAC files.
2. **Tracks:** pick a track (or tick several) and give it a song. Set the speed (0.50x–2.00x, keeping the pitch or
   not) and the volume, and listen before you export.
3. **Export:** download the zip, then copy its `RetroRewind6` folder to your SD card, or into
   `Dolphin Emulator/Load/Riivolution/WheelWizard` for Dolphin through Wheel Wizard.

Songs become looping 32 kHz DSP-ADPCM `.brstm` files in `RetroRewind6/Patches`, the folder Retro Rewind loads over its
own music. Tracks where Retro Rewind has its own final lap file get one too. Songs stay in your browser; nothing is
uploaded.

## common.szs

1. Open Mario Kart Wii's `Race/Common.szs` (or a mod's copy).
2. **Effect colors:** pick a color for a group of race effects (mini-turbo sparks, trick boost, item effects, splashes:
   34 groups covering all 516 effects in `Effect/RKRace.breff`). The group's main color becomes the pick; the rest take
   its hue and keep their light and dark. **Keep white** leaves near-white parts alone.
3. **Textures:** see the 94 effect textures in `Effect/RKRace.breft`, with the effects that use each. Replace one with
   your own image (saved as RGB5A3, at 1×, 2× or 4× the original size), or download it as a PNG. The trick ring is
   `rk_hamon`. The game tints textures with the effect's colors; **Untint** sets those groups to white.
4. Save. The new `common.szs` is Yaz0-compressed again; put it where the one you opened came from.

Recoloring changes only RGB bytes: alpha, sizes and timing stay as they were.

## Development

Needs Node 22.18 or newer.

```
npm install
npm run dev        # http://localhost:3000/rewind-overlay/
npm test           # unit tests (encoder, overlay links, tracks, zip, tags)
npm run typecheck
npm run lint
npm run build      # static site in out/
```

The site is a Next.js static export (App Router, React, TypeScript). `src/app` holds the pages, `src/components`
their UI, `src/lib` the logic, and `src/workers` the encoder's worker. `public/overlay` is the overlay page itself, which
OBS loads; it's a built copy of MichaelAccount1's Rewind Overlay (MIT) plus `ww-plus.js`.

The `Deploy` workflow builds and publishes to GitHub Pages on every push to `main`, and every 30 minutes refreshes
`public/data` (RR Lounge countries and divisions, which browsers can't read) and republishes if it changed. Pages must
be set to deploy from **GitHub Actions** (Settings > Pages > Source).

## Credits

- VR from [rwfc.net](https://rwfc.net); MMR, countries and divisions from [rr-lounge.com](https://rr-lounge.com).
- The track list and music file rules come from [Music Pack Maker](https://github.com/imlucaa/RRMusicPackMaker), which
  reads them from Retro Rewind and follows the [Pulsar](https://github.com/Retro-Rewind-Team/Pulsar) source. The
  encoder is checked byte for byte against [VGAudio](https://github.com/Thealexbarney/VGAudio).
- Mario Kart Wii font art belongs to Nintendo; the VR rank badges to Retro Rewind.
