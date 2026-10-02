# Happy Forest — Electric Forest 2026 crew app

A cross-platform companion app for a group trip to Electric Forest (Rothbury, MI, Jun 25–28, 2026). Built with React and packaged for iOS and Android with Capacitor.

## Features
- **Live venue map:** GPS-anchored map of the festival grounds (stages, camping, Sherwood Court) that tracks your position as you walk
- **Crew planning:** who's arriving how (driving, flight), and a shared packing list where people claim items ("I'm bringing it" / "Need it — anyone?")
- **Shared state:** syncs across the crew through Supabase, with a local cache for spotty festival signal

## Stack
React 18 · Capacitor 8 (Geolocation, Haptics, Splash Screen, Status Bar, Keyboard) · Supabase · built with a small Node script that transpiles the JSX with the TypeScript compiler into a single self-contained `index.html`

## Build
```bash
cd app
npm install
npm run sync      # build dist/index.html and copy it into the native projects
npm run open:ios  # open in Xcode (Android: npx cap open android)
```

## Layout
| Path | What |
|---|---|
| `app/HappyForest2026.jsx` | The whole app (single React component file) |
| `app/build.mjs` | Build script → `app/dist/index.html` |
| `app/ios`, `app/android` | Capacitor native projects |
| `gps-map-prototype.html` | Early standalone prototype of the GPS map |
| `venue-map.jpg`, `full-map.jpg` | Map images used for the overlay |
