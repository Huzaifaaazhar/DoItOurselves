# University Road Rider 🏍️

A 3D endless-runner-style riding game set on **Karachi's University Road**, from Hassan Square to Safoora Chowrangi.
You ride a Honda CD70, pick a real start and destination, and survive potholes, open manholes, gutter water,
BRT Red Line construction, lane cutters, sudden brakers, buses stopping mid-road, wrong-way riders, stray cattle
and dust storms. Coins you collect pay to **fix the road permanently**, one stretch at a time.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| 3D engine | **Three.js** (WebGL) | Lightweight, runs at 60fps on mid-range Android phones |
| Language / build | **TypeScript + Vite** | Typed code, fast builds, tiny bundle (~140 KB gzipped) |
| Android app | **Capacitor 6** | Wraps the game as a native Android app (APK/AAB) for the Play Store |
| Audio | Web Audio API, synthesized | No audio files to ship; engine "putt-putt", horn, music |
| Fonts | Poppins (bundled via @fontsource) | Works offline in the app |

## Project layout

```
src/
  data/route.ts     ← the real road: places, coordinates, per-stretch hazards, fixes. Edit this to correct anything.
  state.ts          ← save data: coins, fixes, upgrades, paints, settings, stats
  game/Game.ts      ← game engine: spawning, physics, collisions, weather, camera
  game/models.ts    ← all 3D models (procedural low-poly) + curved-world shader
  game/audio.ts     ← synthesized sound
  ui/ui.ts          ← screens: home, ride planner map, HUD, pause, results, fix-the-road, garage, settings
  ui/styles.css
android/            ← native Android project (Capacitor)
```

## Features

- **Real route**: 12 places along University Road placed by real lat/lng, shown on an in-game map. Green road signs
  (English + Urdu) and landmarks: chowrangi roundabouts, KU / NED / Urdu University / Sir Syed gates, Civic Centre,
  Expo Centre dome, Safari Park.
- **Hazards weighted per stretch** to match reality: BRT works & dust past NIPA, sewage near Hassan Square / Urdu
  University, students crossing near campuses.
- **Traffic AI**: cars, green rickshaws, Qingqis, decorated W-11 buses, water tankers. Lane cutters use indicators, sudden
  brakers flash brake lights, buses stop mid-road, wrong-way bikers come at you head-on.
- **Controls**: swipe lanes, swipe up to jump, swipe down to brake, **horn** clears pedestrians and cows.
- **Power-ups**: coin magnet, helmet shield, chai (heal).
- **Time & weather**: day, evening rush, night (headlight + street lights), dusty, monsoon rain. Tough conditions pay more.
- **Fix the road**: 11 fixes × 11 stretches, permanent, shown as a colour-coded map.
- **Garage**: 6 upgrades × 5 levels, 5 paint jobs.
- Results with stars, "what hurt you most", stats, settings (sound, music, vibration, graphics), Android back button.

## Run it

```bash
npm install
npm run dev        # open the printed URL; use phone emulation in DevTools
```

## Build the Android app (Play Store)

Requires **Android Studio** (with Android SDK) on your computer.

```bash
npm run android:sync   # builds the game and copies it into android/
npm run android:open   # opens Android Studio
```

In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**, create a keystore (keep it safe,
never commit it), then upload the `.aab` to the Google Play Console.

Before publishing, also:
- Replace the default app icon: put a 1024×1024 PNG at `assets/icon.png` and run `npx @capacitor/assets generate`.
- Write a privacy policy (the game stores progress only on the device and collects no data).
- Play Store listing needs screenshots, a feature graphic (1024×500) and a short description.

## Known limits / next steps

- Models are procedural low-poly. For a more premium look, swap in GLB models (e.g. made in Blender) through `models.ts`.
- Place positions are approximate. Correct `lat`, `lng` and `km` in `src/data/route.ts` against Google Maps.
- Ideas: daily missions, leaderboards (Google Play Games), rewarded ads for bonus coins, Urdu UI language toggle.
