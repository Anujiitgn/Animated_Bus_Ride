# Ahmedabad → Mumbai Bus Ride

An animated 534 km bus journey down NH48 in about 10 hours. The sky, light, mist and temperature change with the clock and the bus's position, and an original Hindustani-style soundtrack follows the time of day (Bhairav at dawn, Bhupali by day, Yaman at dusk, Malkauns at night).

## Files
- `index.html`: page structure
- `style.css`: all styling
- `script.js`: animation, map, readouts and the synthesised music (no libraries, no audio files)

## Run it locally
Open `index.html` in a browser. That's it.

## Publish on GitHub Pages
1. Create a new public repository on GitHub, for example `bus-ride`.
2. Upload `index.html`, `style.css`, `script.js` and this README to the root of the repository (Add file → Upload files → Commit).
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick the `main` branch and the `/ (root)` folder, then **Save**.
5. After a minute or two the site is live at `https://<your-username>.github.io/bus-ride/`.

To put it on your existing site instead (for example `anujiitgn.github.io`), copy the three files into a folder such as `bus-ride/` in that repository; it will be live at `https://anujiitgn.github.io/bus-ride/`.

## Notes
- Music starts only after a tap (browsers block sound until the visitor interacts).
- Halts, timings and weather are a typical schedule and late-November averages, not a real timetable or live forecast. The map is simplified.
