# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/edanteuu/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/edanteuu/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Nusa Airlift v3** — a real-3D prop-plane courier game over a volcanic island archipelago, built in Three.js (vendored locally, no CDN, no network at runtime). Fly a little red-and-white airlift plane through glowing target rings, mind your fuel and your airspeed, and put her down on runway 36 on Nusa Besar — or on the beach strip on Pulau Pasir when someone needs rescuing.

## What's in v3

- **Real 3D, more realistic** — WebGL renderer with ACES filmic tone mapping, soft shadows, fog for depth, a gradient sky dome with sun glow and stars, procedural clouds, a smoking volcano with a glowing lava crater, and an ocean with animated waves, sun glint, an animated bump map and breathing shoreline foam.
- **A living archipelago** — a finer heightfield with seeded noise hills and a procedural speckle texture, 560 instanced jungle trees and 90 palms, and a real airfield: control tower, hangar, a parked sister ship, fuel drums and PAPI lights beside the threshold.
- **Chase view + cockpit view** — press C to sit in the cockpit: a lit 3D instrument panel whose attitude ball, altimeter and airspeed needles move with the plane, plus a yoke, a landing light with a visible beam, and the glass HUD.
- **10 missions + Free Flight** — Ring Run, Island Hop, Storm Landing, Cargo Chain (multi-island package run), Rescue Pickup (land on the beach, pick up a stranded hiker, fly home), Night Flight (dusk, lit runway, navigation lights), Time Trial (gates against a 180-second clock), Storm Crossing (turbulence, low visibility, rain and lightning), Volcano Survey (rings around the crater at 400 m) and Golden Hour Cargo (dusk, short tank). Free Flight explores the archipelago with no objectives.
- **Weather that fights back** — driving rain and lightning flashes on the squall missions, gusts and turbulence in heavy wind.
- **Hangar** — four liveries (Nusa Red, Ocean Blue, Sunset Gold, Jungle Green), switchable from the title screen.
- **Full menu** — Campaign mission grid, Free Flight, Hangar, and a How to Fly panel.
- **Depth** — fuel burn and stalls, damage and hard landings, wind and gusts, flaps and ground effect for landing, cleared glide-slope approaches to both strips, a light pillar marking the next ring, and a par-time bonus per mission.
- **Presentation** — a modern glass HUD (altitude, speed, heading, fuel, damage, mission objective, compass strip, throttle) with a live minimap of the islands, rings and runway, engine smoke, sea spray, landing dust and ring-pass bursts, and sounds synthesised live with WebAudio (engine, wind and a high-speed whistle).

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

Controls: Arrow keys / WASD — pitch and bank · W / S (or Shift / Ctrl) — throttle · Space — flaps (slows you for landing) · C — chase/cockpit camera · mouse drag steers too · click the mission buttons · P pause · R restart · M sound on/off · 1–0 pick a mission, F Free Flight.

Screenshots in `screenshots/` are real renders of the game itself, taken with `?shot=start|play|rings|land&seed=1`: the title over the archipelago, a low banked run past the jungle, the cockpit view with the ring ahead, and the final approach to runway 36.

---

<sub>Entered on [make.fun](https://make.fun/?ref=edanteuu&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
