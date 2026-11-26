# India Bus Journey

Type any two Indian cities and watch an animated bus journey between them:

- **Realistic routes** along national-highway corridors (NH44, NH48, NH19, NH16, NH27, NH66 and more) across a network of ~230 cities, avoiding the sea and neighbouring countries.
- **Scenery by terrain**: Himalaya with snow, Western/Eastern Ghats, Aravalli, Thar desert with camels, Rann of Kutch, coast with palms and boats, forests, farmland (crop changes with state and season), cities and industrial belts with chimneys.
- **River crossings** with bridges (Ganga, Yamuna, Narmada, Godavari, Krishna, Kaveri, Brahmaputra and ~25 more).
- **Sky, weather and temperature** from the real sun position for your date and departure time, monsoon rain, winter fog in the north, cold mountain air.
- **Regional music**, synthesised live (no audio files): Punjabi dhol, Rajasthani folk, Gujarati garba, Marathi lavani, Carnatic, Bengali bhatiyali, North-East bamboo flute, Pahadi, and Hindustani ragas that follow the clock.
- **Infographics**: distance, time, states, terrain mix, route profile, river list, journey log and a map.

## Files
`index.html`, `style.css`, `data.js` (cities, highways, terrain zones, rivers, coastline), `app.js` (routing, scene, music, charts). No libraries, no API keys.

## Publish on GitHub Pages
1. Create a public repository (e.g. `india-bus-journey`) and upload all files to the root.
2. Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
3. Live at `https://<username>.github.io/india-bus-journey/` in a minute or two.

Or drop the files into a folder of your existing `username.github.io` repository.

## Add a city
Append a line to `CITIES` in `data.js`: `["Name","STATE_CODE",lon,lat,size(1-3),industrial(0/1)]`. To make routes prefer a road, add it to `HIGHWAYS` as a comma-separated city chain.

## Notes
Distances, terrain, crops, weather and temperatures are simplified sketches, not navigation or forecasts. Music starts after a tap because browsers block autoplaying sound.
