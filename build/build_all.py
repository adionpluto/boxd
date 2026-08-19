import csv
import json
import os
import sys
import time
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

API_KEY = "2a676a111220c1f9a4e2550238a9a294"
CACHE_DIR = "data/cache"
DATA_DIR = "data"
OUTPUT_FILE = "site/data/enriched.json"
REGION = "IN"

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs("site/data", exist_ok=True)

# 1. Parse Profile
profile = None
p_path = os.path.join(DATA_DIR, "profile.csv")
if os.path.exists(p_path):
    with open(p_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            favs = [uri.strip() for uri in row.get("Favorite Films", "").split(",") if uri.strip()]
            profile = {
                "username": row.get("Username", ""),
                "given_name": row.get("Given Name", ""),
                "family_name": row.get("Family Name", ""),
                "date_joined": row.get("Date Joined", ""),
                "bio": row.get("Bio", ""),
                "website": row.get("Website", ""),
                "location": row.get("Location", ""),
                "pronoun": row.get("Pronoun", ""),
                "favorite_films": favs
            }
            break

# 2. Parse CSVs
films_map = {}

def get_film(name, year, uri):
    name = (name or "").strip()
    year = (year or "").strip()
    if not name: return None
    key = (name.lower(), year)
    if key not in films_map:
        films_map[key] = {
            "id": "-".join(name.lower().split()),
            "title": name,
            "year": int(year) if year and year.isdigit() else None,
            "letterboxd_uri": uri or "",
            "rating": None,
            "watched_dates": set(),
            "rewatch": False,
            "review": "",
            "tags": set(),
            "liked": False,
            "in_watchlist": False,
            "in_diary": False,
            "tmdb_id": None
        }
    return films_map[key]

# Diary
d_path = os.path.join(DATA_DIR, "diary.csv")
if os.path.exists(d_path):
    with open(d_path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            f_obj = get_film(row.get("Name"), row.get("Year"), row.get("Letterboxd URI"))
            if not f_obj: continue
            f_obj["in_diary"] = True
            r = row.get("Rating")
            if r:
                try: f_obj["rating"] = float(r)
                except ValueError: pass
            d = row.get("Watched Date")
            if d: f_obj["watched_dates"].add(d)
            if row.get("Rewatch", "").lower() == "yes": f_obj["rewatch"] = True
            t = row.get("Tags")
            if t: f_obj["tags"].update(x.strip() for x in t.split(",") if x.strip())

# Ratings
r_path = os.path.join(DATA_DIR, "ratings.csv")
if os.path.exists(r_path):
    with open(r_path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            f_obj = get_film(row.get("Name"), row.get("Year"), row.get("Letterboxd URI"))
            if not f_obj: continue
            r = row.get("Rating")
            if r:
                try: f_obj["rating"] = float(r)
                except ValueError: pass
            d = row.get("Date")
            if d: f_obj["watched_dates"].add(d)

# Watched
w_path = os.path.join(DATA_DIR, "watched.csv")
if os.path.exists(w_path):
    with open(w_path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            f_obj = get_film(row.get("Name"), row.get("Year"), row.get("Letterboxd URI"))
            if not f_obj: continue
            d = row.get("Watched Date") or row.get("Date")
            if d: f_obj["watched_dates"].add(d)

# Watchlist
wl_path = os.path.join(DATA_DIR, "watchlist.csv")
if os.path.exists(wl_path):
    with open(wl_path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            f_obj = get_film(row.get("Name"), row.get("Year"), row.get("Letterboxd URI"))
            if not f_obj: continue
            f_obj["in_watchlist"] = True

# Reviews
rev_path = os.path.join(DATA_DIR, "reviews.csv")
if os.path.exists(rev_path):
    with open(rev_path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            f_obj = get_film(row.get("Name"), row.get("Year"), row.get("Letterboxd URI"))
            if not f_obj: continue
            f_obj["review"] = row.get("Review", "")
            r = row.get("Rating")
            if r:
                try: f_obj["rating"] = float(r)
                except ValueError: pass
            d = row.get("Watched Date") or row.get("Date")
            if d: f_obj["watched_dates"].add(d)
            if row.get("Rewatch", "").lower() == "yes": f_obj["rewatch"] = True
            t = row.get("Tags")
            if t: f_obj["tags"].update(x.strip() for x in t.split(",") if x.strip())

all_films = list(films_map.values())
for f in all_films:
    f["watched_dates"] = sorted(list(f["watched_dates"]))
    f["tags"] = sorted(list(f["tags"]))
    f["liked"] = f["rating"] is not None and f["rating"] >= 4.0

print(f"Parsed {len(all_films)} unique films.")

# Fast network fetching with local caching
def get_tmdb_info(title, year):
    # Search
    encoded = urllib.parse.quote(title)
    url = f"https://api.themoviedb.org/3/search/movie?api_key={API_KEY}&query={encoded}"
    if year: url += f"&year={year}"
    
    req = urllib.request.Request(url, headers={"User-Agent": "boxd/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if not data.get("results") and year:
                url_no_yr = f"https://api.themoviedb.org/3/search/movie?api_key={API_KEY}&query={encoded}"
                req2 = urllib.request.Request(url_no_yr, headers={"User-Agent": "boxd/1.0"})
                with urllib.request.urlopen(req2, timeout=4) as resp2:
                    data = json.loads(resp2.read().decode("utf-8"))
            if data and data.get("results"):
                tmdb_id = data["results"][0]["id"]
                # Check file cache for details
                c_file = os.path.join(CACHE_DIR, f"{tmdb_id}.json")
                if os.path.exists(c_file):
                    try:
                        with open(c_file, "r", encoding="utf-8") as cf:
                            return json.load(cf)
                    except Exception:
                        pass
                # Fetch details
                det_url = f"https://api.themoviedb.org/3/movie/{tmdb_id}?api_key={API_KEY}&append_to_response=credits,keywords,watch/providers"
                req3 = urllib.request.Request(det_url, headers={"User-Agent": "boxd/1.0"})
                with urllib.request.urlopen(req3, timeout=4) as resp3:
                    details = json.loads(resp3.read().decode("utf-8"))
                    if details and "id" in details:
                        try:
                            with open(c_file, "w", encoding="utf-8") as cf:
                                json.dump(details, cf, indent=2)
                        except Exception:
                            pass
                        return details
    except Exception:
        pass
    return None

def enrich_single(f):
    details = get_tmdb_info(f["title"], f.get("year"))
    if details and "id" in details:
        f["tmdb_id"] = details["id"]
        f["genres"] = [g["name"] for g in details.get("genres", [])]
        f["countries"] = [{"code": c["iso_3166_1"], "name": c["name"]} for c in details.get("production_countries", [])]
        f["languages"] = [{"code": l["iso_639_1"], "name": l["name"]} for l in details.get("spoken_languages", [])]
        f["runtime"] = details.get("runtime")
        
        credits = details.get("credits", {})
        f["directors"] = [{"id": c["id"], "name": c["name"]} for c in credits.get("crew", []) if c.get("job") == "Director"]
        f["cast"] = [{"id": c["id"], "name": c["name"], "character": c.get("character", "")} for c in credits.get("cast", [])[:10]]
        
        kws = details.get("keywords", {}).get("keywords", [])
        f["keywords"] = [k["name"] for k in kws]
        
        f["poster"] = details.get("poster_path")
        f["backdrop"] = details.get("backdrop_path")
        f["overview"] = details.get("overview")
        f["vote_average"] = details.get("vote_average")
        
        providers = details.get("watch/providers", {}).get("results", {}).get(REGION, {})
        f["watch_providers"] = {
            "flatrate": [{"name": p["provider_name"], "logo": p["logo_path"]} for p in providers.get("flatrate", [])],
            "rent": [{"name": p["provider_name"], "logo": p["logo_path"]} for p in providers.get("rent", [])],
            "buy": [{"name": p["provider_name"], "logo": p["logo_path"]} for p in providers.get("buy", [])]
        }
    return f

print("Enriching films in parallel (20 threads)...")
enriched_films = [None] * len(all_films)
with ThreadPoolExecutor(max_workers=20) as executor:
    futures = {executor.submit(enrich_single, f): idx for idx, f in enumerate(all_films)}
    done = 0
    for fut in as_completed(futures):
        idx = futures[fut]
        try:
            enriched_films[idx] = fut.result()
        except Exception:
            enriched_films[idx] = all_films[idx]
        done += 1
        if done % 100 == 0 or done == len(all_films):
            print(f"  {done}/{len(all_films)} films processed...")

# Recommendations
print("Generating recommendations...")
liked_films = [f for f in enriched_films if f and f.get("rating") is not None and f["rating"] >= 4.0 and f.get("tmdb_id")]
candidates = [f for f in enriched_films if f and not f.get("in_diary") and not f.get("watched_dates") and f.get("tmdb_id")]

def jaccard(s1, s2):
    if not s1 and not s2: return 0.0
    inter = len(s1.intersection(s2))
    union = len(s1.union(s2))
    return inter / union if union > 0 else 0.0

recommendations = []
for c in candidates:
    c_genres = set(c.get("genres", []))
    c_keywords = set(c.get("keywords", []))
    c_directors = set(d["id"] for d in c.get("directors", []))
    c_cast = set(ca["id"] for ca in c.get("cast", [])[:5])

    max_score = 0.0
    best_reasons = []
    best_because = []

    for l in liked_films:
        l_genres = set(l.get("genres", []))
        l_keywords = set(l.get("keywords", []))
        l_directors = set(d["id"] for d in l.get("directors", []))
        l_cast = set(ca["id"] for ca in l.get("cast", [])[:5])

        s_genres = jaccard(c_genres, l_genres)
        s_keywords = jaccard(c_keywords, l_keywords)
        dir_overlap = len(c_directors.intersection(l_directors))
        s_directors = 1.0 if dir_overlap > 0 else 0.0
        s_cast = jaccard(c_cast, l_cast)

        score = (0.30 * s_genres) + (0.35 * s_keywords) + (0.20 * s_directors) + (0.15 * s_cast)
        if score > max_score:
            max_score = score
            reasons = []
            if s_genres > 0: reasons.append(f"Shares genres: {', '.join(c_genres.intersection(l_genres))}")
            if s_keywords > 0: reasons.append(f"Shares keywords: {', '.join(c_keywords.intersection(l_keywords))}")
            if s_directors > 0: reasons.append(f"Same director: {', '.join(d['name'] for d in c.get('directors', []) if d['id'] in l_directors)}")
            if s_cast > 0: reasons.append(f"Shares cast: {', '.join(ca['name'] for ca in c.get('cast', []) if ca['id'] in l_cast)}")
            best_reasons = reasons
            best_because = [l["title"]]
        elif score == max_score and score > 0:
            best_because.append(l["title"])

    if max_score > 0:
        recommendations.append({
            "tmdb_id": c["tmdb_id"],
            "title": c["title"],
            "year": c.get("year"),
            "poster": c.get("poster"),
            "genres": c.get("genres", []),
            "overview": c.get("overview", ""),
            "score": round(max_score, 4),
            "reasons": best_reasons,
            "because": best_because
        })

recommendations.sort(key=lambda x: x["score"], reverse=True)

out_data = {
    "meta": {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_watched": sum(1 for f in enriched_films if f and (f.get("watched_dates") or f.get("in_diary"))),
        "total_watchlist": sum(1 for f in enriched_films if f and f.get("in_watchlist")),
        "total_rated": sum(1 for f in enriched_films if f and f.get("rating") is not None),
        "tmdb_region": REGION,
        "profile": profile
    },
    "films": enriched_films,
    "recommendations": recommendations[:50]
}

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(out_data, f, indent=2, ensure_ascii=False)

print(f"DONE! Written {len(enriched_films)} films to {OUTPUT_FILE} (Watched: {out_data['meta']['total_watched']}, Watchlist: {out_data['meta']['total_watchlist']})")
