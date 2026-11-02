# University Road Rider — project guide

3D riding game set on Karachi's University Road (Hassan Square → Safoora Chowrangi). Ship target: Android (Play Store) + free web build.
Quality bar: studio-made, not a tutorial. Visual source of truth: `game/design-refs/` (start with `concept-mockup.jpg`).

## Stack
- `game/` — Next.js 14 (App Router, `output: "export"`) + TypeScript (strict) + Tailwind 3 with CSS-variable tokens.
- 3D: `three` (current engine in `src/game/`). Phase 3 ports rendering to `@react-three/fiber` + `drei` + `@react-three/postprocessing`.
- Motion: Framer Motion (UI), GSAP (camera timelines). Physics: none needed (lane runner; see DECISIONS).
- Android: Capacitor 6 wraps `out/`. CI builds a debug APK on every push (`.github/workflows/android.yml`).
- Fonts are self-hosted from npm `@fontsource/*` (same Google Fonts, no runtime request).

## Layout
- `src/data/route.ts` — real places, coordinates, per-stretch hazards, fixes. Single place to correct road data.
- `src/state.ts` — save data. `src/game/` — engine, models, audio. `src/ui/` — screens (legacy DOM UI, being replaced by React in Phase 2).
- `src/components/` — React shell, fallback poster, icons. `app/tokens.css` — design tokens.
- `scripts/shots.mjs` — visual QA. `docs/DECISIONS.md` — one line per non-obvious choice. `public/ASSETS.md` — asset sources + licences.

## Commands (run in `game/`)
- `npm run dev` — dev server · `npm run build` — static export to `out/`
- `npm test` — typecheck + every scene loads without errors · `npm run shots [-- name]` — screenshots to `shots/` at 390×844 and 1440×900, refreshes `public/poster.jpg`
- `npm run android:sync` / `android:open` / `android:apk`

## Design tokens (app/tokens.css)
Sand `217 185 138` · haze `233 207 160` · asphalt `46 45 43` · ink `20 17 14` · paper `244 236 220` · signage green `17 112 47` · BRT green `43 147 72` · warning yellow `255 212 59` · brick `176 120 74` · alert red `224 49 49`.
Type: Barlow Condensed (display, banners), Inter (UI), Noto Nastaliq Urdu (bilingual signs). Scale 12/14/16/20/28/40/56/72, headline line-height ~0.95.
Radius: plate 6px, card 14px, pill. Shadows warm and layered. Grain overlay 4%.
UI language: black label plates with thin white borders, yellow banner text on dark ribbons, green road-sign plates. No emoji, no generic SaaS cards.

## 3D realism checklist (every scene)
1. ACES (or AgX) tone mapping, sRGB output; colour textures sRGB, data maps linear.
2. Image-based lighting always on (HDRI or Lightformers), never only ambient + one light.
3. PBR with roughness variation; physical materials for paint, chrome, glass.
4. Everything grounded: contact/baked shadows, nothing floats.
5. Bevelled edges on hero objects.
6. Hero camera FOV 30–40°, real-world scale (lanes 3.4 m, CD70 ~1.9 m).
7. Depth cues: haze, foreground/mid/background layers, dust motes; DoF on hero shots only.
8. Restrained post: SMAA, high-threshold bloom, soft vignette, light grain.
9. Imperfection: cracks, patches, dust, scuffs.
10. Motion has weight: eased/spring, never linear.

## Performance budgets
Draw calls < 150 desktop / 80 mobile · triangles < 300k / 120k · initial 3D chunk < 500 KB gz (excl. assets).
DPR capped [1, 1.75] mobile, [1, 2] desktop; step down on fps drops; Graphics: Auto / High / Low.
No allocation per frame; reuse vectors; dispose on unmount; instance repeats; one real-time shadow light.
Target 60 fps desktop, ≥45 fps mid-range Android. No WebGL / reduced motion / weak device → poster fallback; app must work without 3D.

## Assets
CC0 / CC-BY only: Poly Haven (HDRI, PBR), ambientCG (PBR), Quaternius / Kenney (models), Sketchfab (downloadable + CC-BY).
Compress GLBs with gltf-transform (Draco/Meshopt + KTX2), textures ≤ 2048 (1024 mobile). Log every asset in `public/ASSETS.md`.

## Working rules
- Plan, then work in phases; each phase ends deployable and passes its checklist.
- Never judge visuals from code: run `npm run shots`, open the images, critique 3 bullets against the checklist + refs, fix, repeat ≥ 3 rounds per hero scene.
- Read installed package types in `node_modules` before using an API. Pin versions.
- No placeholders that ship (no lorem, grey boxes, emoji, default fonts).
