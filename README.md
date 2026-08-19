# boxd

a minimalist, personal archive and tracker for your letterboxd history.

---
features:

- filter your activity feed by activity type.
  
- personalized stats pages (sorting films by year, genre, country, director).
  
- recommendations based on your watched/watchlist set of films.

---
how to update your data:
#a: in-browser instant sync (no terminal required)
1. export your data from letterboxd: **letterboxd → settings → data → export your data** (downloads a `.zip` file).
2. open **boxd** in your browser.
3. click the **sync data** button in the top navigation bar.
4. drag & drop your downloaded `.zip` file (or individual .csv files).
5. your updated profile should be loaded shortly after that.
   
#b: review locally
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
│   ├── enrich.py                 ← core TMDb fetch & normalizer
│   ├── recommend.py              ← content-based recommendation algorithm
│   └── requirements.txt
├── data/                         ← letterboxd csvs & TMDb cache
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
        ├── importer.js           ← in-browser zip/csv parser & TMDb enricher
        ├── filters.js            ← faceted filters & library grid
        ├── charts.js             ← chart.js analytics & heatmap
        ├── worldmap.js           ← d3.js full-screen choropleth map
        └── recommendations.js    ← personalized recommendations ui
```

---
attribution & license:

- movie metadata and poster artwork provided by **the movie database (TMDb)**.
  
  *this product uses the TMDb api but is not endorsed or certified by TMDb or by Letterboxd.*
  
