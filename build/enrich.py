import csv
import json
import os
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

API_KEY = os.environ.get("TMDB_API_KEY", "2a676a111220c1f9a4e2550238a9a294")
REGION = os.environ.get("TMDB_REGION", "IN")
CACHE_DIR = "data/cache"
DATA_DIR = "data"
OUTPUT_FILE = "site/data/enriched.json"
SEARCH_CACHE_FILE = "data/search_cache.json"

search_cache = {}

def init_dirs():
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    global search_cache
    if os.path.exists(SEARCH_CACHE_FILE):
        try:
            with open(SEARCH_CACHE_FILE, "r", encoding="utf-8") as f:
                search_cache = json.load(f)
        except Exception:
            search_cache = {}

def save_search_cache():
    try:
        with open(SEARCH_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(search_cache, f, indent=2)
    except Exception:
        pass

def parse_profile():
    filepath = os.path.join(DATA_DIR, "profile.csv")
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                favs = [uri.strip() for uri in row.get("Favorite Films", "").split(",") if uri.strip()]
                return {
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
    except Exception as e:
        print(f"Error parsing profile: {e}")
    return None

def parse_csvs():
    films = {}
    
    def process_file(filename, row_handler):
        filepath = os.path.join(DATA_DIR, filename)
        if not os.path.exists(filepath):
            return
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get("Name", "").strip()
                year = row.get("Year", "").strip()
                if not name:
                    continue
                key = (name, year)
                if key not in films:
                    films[key] = {
                        "id": "-".join(name.lower().split()),
                        "title": name,
                        "year": int(year) if year and year.isdigit() else None,
                        "letterboxd_uri": row.get("Letterboxd URI", ""),
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
                row_handler(films[key], row)

    def diary_handler(f, row):
        f["in_diary"] = True
        rating = row.get("Rating")
        if rating:
            try: f["rating"] = float(rating)
            except ValueError: pass
        date = row.get("Watched Date")
        if date: f["watched_dates"].add(date)
        rewatch = row.get("Rewatch")
        if rewatch and rewatch.lower() == "yes": f["rewatch"] = True
        tags = row.get("Tags")
        if tags: f["tags"].update(t.strip() for t in tags.split(",") if t.strip())

    def ratings_handler(f, row):
        rating = row.get("Rating")
        if rating:
            try: f["rating"] = float(rating)
            except ValueError: pass
        date = row.get("Date")
        if date: f["watched_dates"].add(date)

    def watched_handler(f, row):
        date = row.get("Watched Date") or row.get("Date")
        if date: f["watched_dates"].add(date)

    def watchlist_handler(f, row):
        f["in_watchlist"] = True

    def reviews_handler(f, row):
        f["review"] = row.get("Review", "")
        rating = row.get("Rating")
        if rating:
            try: f["rating"] = float(rating)
            except ValueError: pass
        date = row.get("Watched Date") or row.get("Date")
        if date: f["watched_dates"].add(date)
        rewatch = row.get("Rewatch")
        if rewatch and rewatch.lower() == "yes": f["rewatch"] = True
        tags = row.get("Tags")
        if tags: f["tags"].update(t.strip() for t in tags.split(",") if t.strip())

    process_file("diary.csv", diary_handler)
    process_file("ratings.csv", ratings_handler)
    process_file("watched.csv", watched_handler)
    process_file("watchlist.csv", watchlist_handler)
    process_file("reviews.csv", reviews_handler)

    for f in films.values():
        f["watched_dates"] = sorted(list(f["watched_dates"]))
        f["tags"] = sorted(list(f["tags"]))
        f["liked"] = f["rating"] is not None and f["rating"] >= 4.0

    return list(films.values())

def fetch_json(url):
    sep = "&" if "?" in url else "?"
    full_url = f"{url}{sep}api_key={API_KEY}"
    req = urllib.request.Request(full_url, headers={
        "User-Agent": "boxd-archive/1.0",
        "Accept": "application/json"
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return None

def search_tmdb(title, year):
    cache_key = f"{title.lower()}___{year or ''}"
    if cache_key in search_cache:
        return search_cache[cache_key]

    encoded_title = urllib.parse.quote(title)
    url = f"https://api.themoviedb.org/3/search/movie?query={encoded_title}"
    if year:
        url += f"&year={year}"
    res = fetch_json(url)
    if res and res.get("results") and len(res["results"]) > 0:
        tmdb_id = res["results"][0]["id"]
        search_cache[cache_key] = tmdb_id
        return tmdb_id
    
    if year:
        url_noyear = f"https://api.themoviedb.org/3/search/movie?query={encoded_title}"
        res2 = fetch_json(url_noyear)
        if res2 and res2.get("results") and len(res2["results"]) > 0:
            tmdb_id = res2["results"][0]["id"]
            search_cache[cache_key] = tmdb_id
            return tmdb_id

    search_cache[cache_key] = None
    return None

def get_tmdb_details(tmdb_id):
    url = f"https://api.themoviedb.org/3/movie/{tmdb_id}?append_to_response=credits,keywords,watch/providers"
    return fetch_json(url)

def enrich_film(f, force=False):
    title = f["title"]
    year = f["year"]
    
    tmdb_id = search_tmdb(title, year)
    if not tmdb_id:
        return f

    f["tmdb_id"] = tmdb_id
    cache_path = os.path.join(CACHE_DIR, f"{tmdb_id}.json")
    
    details = None
    if not force and os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as file:
                details = json.load(file)
        except Exception:
            details = None

    if not details:
        details = get_tmdb_details(tmdb_id)
        if details and "id" in details:
            try:
                with open(cache_path, "w", encoding="utf-8") as file:
                    json.dump(details, file, indent=2)
            except Exception:
                pass

    if not details:
        return f
        
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

def main():
    import sys
    force = "--force" in sys.argv
    init_dirs()
    
    profile = parse_profile()
    films = parse_csvs()
    print(f"Parsed {len(films)} unique films.")
    
    enriched_films = [None] * len(films)
    enriched_count = 0
    error_count = 0
    
    print(f"Enriching films with multi-threading (12 workers)...")
    with ThreadPoolExecutor(max_workers=12) as executor:
        future_to_idx = {executor.submit(enrich_film, f, force): idx for idx, f in enumerate(films)}
        completed = 0
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            f = films[idx]
            try:
                enriched = future.result()
                enriched_films[idx] = enriched
                if enriched.get("tmdb_id"):
                    enriched_count += 1
                else:
                    error_count += 1
            except Exception as e:
                error_count += 1
                enriched_films[idx] = f
            completed += 1
            if completed % 50 == 0 or completed == len(films):
                print(f"  Progress: {completed}/{len(films)} films processed ({enriched_count} enriched)...")

    save_search_cache()
    
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
        "recommendations": []
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(out_data, f, indent=2, ensure_ascii=False)
        
    print(f"\nDone! Processed: {len(films)}, Enriched: {enriched_count}, Errors: {error_count}")

if __name__ == "__main__":
    main()
