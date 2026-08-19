# boxd 🎬

a minimalist, personal archive and tracker of your letterboxd history.
---
features:

- filter activity based on location, year, genre, director, rating and language.
- provides a summary of your overall film stats on letterboxd.
- recommendation picker based on your watched/watchlist data.
- world-view map to access number of films watched around the globe.

---

access:

a: in-browser instant sync (no terminal required!)

1. export your data from letterboxd: **letterboxd → settings → data → export your data** (downloads a `.zip` file).
2. open [boxd](https://adionpluto.github.io/boxd/).
3. click the **sync data** button (top-right corner) of the navigation bar.
4. drag & drop your downloaded `.zip` file (or individual .csv files).
5. your personalized account shall now be ready in a moment.

b: preview locally

```bash
cd site
python -m http.server 8080
# open http://localhost:8080 in your browser
```

---
project structure:

```
boxd/
├── .github/workflows/build.yml   ← ci/cd automatic build and deploy
├── build/
│   ├── build_all.py              ← fast multi-threaded enrichment pipeline
│   ├── enrich.py                 ← core tmdb fetch & normalizer
│   ├── recommend.py              ← content-based recommendation algorithm
│   └── requirements.txt
├── data/                         ← letterboxd csvs & tmdb cache
│   ├── profile.csv
│   ├── ratings.csv
│   ├── watched.csv
│   └── watchlist.csv
└── site/                         ← static web application
    ├── index.html                ← app entry point
    ├── .nojekyll                 ← github pages static bypass
    ├── css/
    │   └── style.css             ← dark cinematic styling & modals
    ├── data/
    │   └── enriched.json         ← pre-bundled complete dataset
    └── js/
        ├── app.js                ← core app state & navigation
        ├── importer.js           ← in-browser zip/csv parser & tmdb enricher
        ├── filters.js            ← faceted filters & library grid
        ├── charts.js             ← chart.js analytics & heatmap
        ├── worldmap.js           ← d3.js full-screen choropleth map
        └── recommendations.js    ← personalized recommendations ui
```

---
attribution & license:

- movie metadata and poster artwork provided by **the movie database (tmdb)**.

  *this product uses the tmdb api but is not endorsed or certified by tmdb.*
