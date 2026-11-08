# Overlay

A Retro Rewind VR and RR Lounge MMR overlay for OBS, and a Retro Rewind music pack maker. Both run in the browser.
Nothing to download.

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

The site is a Next.js static export (App Router, React, TypeScript). `src/app` holds the two pages, `src/components`
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
