# boxd 🎬

A minimalist, high-performance cinematic archive and tracker for your Letterboxd history — **free**, fast, and hosted effortlessly on GitHub Pages.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **📥 Client-Side Sync & Login** | Upload your Letterboxd `.zip` export or individual `.csv` files directly in your browser. Automatically extracts, enriches with TMDb metadata, caches in IndexedDB, and updates your library and stats in real time! |
| **👤 Personal Profile** | Displays your Letterboxd identity, member join date, bio quote, and 4 favorite film posters. |
| **📚 Library** | Complete poster grid with responsive layout, instant search/sorting (by date, rating, year, title), and streamlined filters (*Genres, Countries, Decades, Languages*). |
| **📊 Stats Dashboard** | 9 interactive visualization charts (Films Per Month, Rating Distribution, 52-week Activity Heatmap, Top Genres, Top Directors, Top Actors, Decades, and Rating Trends). |
| **🗺️ Full-Screen World Map** | Edge-to-edge D3 choropleth visualizing global cinema watching density with hover cards and click-to-filter capabilities. |
| **🎯 Watchlist** | Complete watchlist catalogue with real-time streaming provider badges (*Flatrate, Rent, Buy*). |
| **🔮 Picks (Recommendations)** | Content-based recommendation engine powered by weighted Jaccard similarity across genres, keywords, directors, and top cast. |

---

## 🚀 Live Usage & How to Update Your Data

### Option A: In-Browser Instant Sync (No terminal required!)
1. Export your data from Letterboxd: **Letterboxd → Settings → Data → Export Your Data** (downloads a `.zip` file).
2. Open **boxd** in your browser.
3. Click the **Sync Data** (📥) button in the top navigation bar.
4. Drag & drop your downloaded `.zip` file (or individual CSVs).
5. Watch the progress bar as your films are enriched with TMDb posters and metadata in seconds. Your updated profile, charts, map, and recommendations will load immediately!

---

### Option B: Build & Deploy to GitHub Pages

#### 1. Fork or Clone this Repository
```bash
git clone https://github.com/your-username/boxd.git
cd boxd
```

#### 2. Add your CSVs (Optional if already bundled)
Place your `watched.csv`, `ratings.csv`, `watchlist.csv`, and `profile.csv` into `data/`.

#### 3. Run the Build Pipeline
```bash
# Permanent TMDb API key is pre-configured
python build/build_all.py
```

#### 4. Preview Locally
```bash
cd site
python -m http.server 8080
# Open http://localhost:8080 in your browser
```

#### 5. Deploy to GitHub Pages
1. Push the repository to GitHub:
   ```bash
   git add .
   git commit -m "Deploy boxd cinema archive"
   git push origin main
   ```
2. In your GitHub repository:
   - Go to **Settings → Pages**
   - Under **Build and deployment → Source**, select **GitHub Actions** (or Deploy from branch `main` folder `/site`).
3. Your site will be live at `https://<your-username>.github.io/<repo-name>/`!

---

## 🛠️ Project Structure

```
boxd/
├── .github/workflows/build.yml   ← CI/CD automatic build and deploy
├── build/
│   ├── build_all.py              ← Fast multi-threaded enrichment pipeline
│   ├── enrich.py                 ← Core TMDb fetch & normalizer
│   ├── recommend.py              ← Content-based recommendation algorithm
│   └── requirements.txt
├── data/                         ← Letterboxd CSVs & TMDb cache
│   ├── profile.csv
│   ├── ratings.csv
│   ├── watched.csv
│   └── watchlist.csv
└── site/                         ← Static Web Application
    ├── index.html                ← App entry point
    ├── .nojekyll                 ← GitHub Pages static bypass
    ├── css/
    │   └── style.css             ← Dark cinematic styling & modals
    ├── data/
    │   └── enriched.json         ← Pre-bundled complete dataset
    └── js/
        ├── app.js                ← Core app state & navigation
        ├── importer.js           ← In-browser ZIP/CSV parser & TMDb enricher
        ├── filters.js            ← Faceted filters & library grid
        ├── charts.js             ← Chart.js analytics & heatmap
        ├── worldmap.js           ← D3.js full-screen choropleth map
        └── recommendations.js    ← Personalized recommendations UI
```

---

## ⚖️ Attribution & License
- Movie metadata and poster artwork provided by **The Movie Database (TMDb)**.
- *This product uses the TMDb API but is not endorsed or certified by TMDb.*
