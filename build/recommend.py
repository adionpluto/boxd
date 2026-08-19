import json
import os

INPUT_FILE = "site/data/enriched.json"

def jaccard(set1, set2):
    if not set1 and not set2:
        return 0.0
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return intersection / union if union > 0 else 0.0

def recommend():
    if not os.path.exists(INPUT_FILE):
        print(f"File {INPUT_FILE} not found. Run enrich.py first.")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    films = data.get("films", [])
    
    # Identify liked films (rating >= 4.0)
    liked_films = [f for f in films if f.get("rating") is not None and f["rating"] >= 4.0]
    
    # Recommendations targeted for unwatched/watchlist films
    candidates = [f for f in films if not f.get("in_diary") and not f.get("watched_dates")]
    
    if not liked_films or not candidates:
        print("Not enough data to make recommendations.")
        return

    recommendations = []
    
    for c in candidates:
        if not c.get("tmdb_id"):
            continue
            
        c_genres = set(c.get("genres", []))
        c_keywords = set(c.get("keywords", []))
        c_directors = set(d["id"] for d in c.get("directors", []))
        c_cast = set(ca["id"] for ca in c.get("cast", [])[:5])
        
        max_score = 0.0
        best_reasons = []
        best_because = []
        
        for l in liked_films:
            if not l.get("tmdb_id"):
                continue
                
            l_genres = set(l.get("genres", []))
            l_keywords = set(l.get("keywords", []))
            l_directors = set(d["id"] for d in l.get("directors", []))
            l_cast = set(ca["id"] for ca in l.get("cast", [])[:5])
            
            s_genres = jaccard(c_genres, l_genres)
            s_keywords = jaccard(c_keywords, l_keywords)
            
            dir_overlap = len(c_directors.intersection(l_directors))
            s_directors = 1.0 if dir_overlap > 0 else 0.0
            
            s_cast = jaccard(c_cast, l_cast)
            
            # Weighted Jaccard
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
    
    data["recommendations"] = recommendations[:50]
    
    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"Generated {len(data['recommendations'])} recommendations.")

if __name__ == "__main__":
    recommend()
