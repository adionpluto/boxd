/**
 * boxd — Clean Client-Side Letterboxd ZIP / CSV Importer & Live Sync Engine
 */

(function () {
    const TMDB_API_KEY = '2a676a111220c1f9a4e2550238a9a294';
    const DB_NAME = 'BoxdCacheDB';
    const DB_VERSION = 1;
    const STORE_MOVIES = 'tmdb_movies';
    const STORE_SEARCH = 'tmdb_search';

    let dbPromise = null;

    function getDB() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_MOVIES)) {
                        db.createObjectStore(STORE_MOVIES, { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains(STORE_SEARCH)) {
                        db.createObjectStore(STORE_SEARCH, { keyPath: 'query' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        return dbPromise;
    }

    async function getCachedMovie(tmdbId) {
        try {
            const db = await getDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_MOVIES, 'readonly');
                const req = tx.objectStore(STORE_MOVIES).get(Number(tmdbId));
                req.onsuccess = () => resolve(req.result ? req.result.data : null);
                req.onerror = () => resolve(null);
            });
        } catch {
            return null;
        }
    }

    async function setCachedMovie(tmdbId, data) {
        try {
            const db = await getDB();
            const tx = db.transaction(STORE_MOVIES, 'readwrite');
            tx.objectStore(STORE_MOVIES).put({ id: Number(tmdbId), data, timestamp: Date.now() });
        } catch {}
    }

    async function getCachedSearch(query) {
        try {
            const db = await getDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_SEARCH, 'readonly');
                const req = tx.objectStore(STORE_SEARCH).get(query.toLowerCase());
                req.onsuccess = () => resolve(req.result ? req.result.tmdbId : undefined);
                req.onerror = () => resolve(undefined);
            });
        } catch {
            return undefined;
        }
    }

    async function setCachedSearch(query, tmdbId) {
        try {
            const db = await getDB();
            const tx = db.transaction(STORE_SEARCH, 'readwrite');
            tx.objectStore(STORE_SEARCH).put({ query: query.toLowerCase(), tmdbId });
        } catch {}
    }

    async function searchTMDb(title, year) {
        const queryKey = `${title}___${year || ''}`;
        const cached = await getCachedSearch(queryKey);
        if (cached !== undefined) return cached;

        const encoded = encodeURIComponent(title);
        let url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encoded}`;
        if (year) url += `&year=${year}`;

        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    const id = data.results[0].id;
                    await setCachedSearch(queryKey, id);
                    return id;
                }
            }
            if (year) {
                const res2 = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encoded}`);
                if (res2.ok) {
                    const data2 = await res2.json();
                    if (data2.results && data2.results.length > 0) {
                        const id = data2.results[0].id;
                        await setCachedSearch(queryKey, id);
                        return id;
                    }
                }
            }
        } catch {}

        await setCachedSearch(queryKey, null);
        return null;
    }

    async function fetchTMDbDetails(tmdbId) {
        if (!tmdbId) return null;
        const cached = await getCachedMovie(tmdbId);
        if (cached) return cached;

        const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,keywords,watch/providers`;
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                await setCachedMovie(tmdbId, data);
                return data;
            }
        } catch {}
        return null;
    }

    async function enrichFilmsConcurrently(films, onProgress) {
        const concurrency = 8;
        let index = 0;
        let completed = 0;
        const total = films.length;

        async function worker() {
            while (index < films.length) {
                const i = index++;
                const film = films[i];

                try {
                    let tmdbId = film.tmdb_id;
                    if (!tmdbId) {
                        tmdbId = await searchTMDb(film.title, film.year);
                    }

                    if (tmdbId) {
                        film.tmdb_id = tmdbId;
                        const details = await fetchTMDbDetails(tmdbId);
                        if (details) {
                            film.genres = (details.genres || []).map(g => g.name);
                            film.countries = (details.production_countries || []).map(c => ({ code: c.iso_3166_1, name: c.name }));
                            film.languages = (details.spoken_languages || []).map(l => ({ code: l.iso_639_1, name: l.name }));
                            film.runtime = details.runtime;
                            film.poster = details.poster_path;
                            film.backdrop = details.backdrop_path;
                            film.overview = details.overview;
                            film.vote_average = details.vote_average;

                            const crew = (details.credits && details.credits.crew) || [];
                            film.directors = crew.filter(c => c.job === 'Director').map(c => ({ id: c.id, name: c.name }));

                            const cast = (details.credits && details.credits.cast) || [];
                            film.cast = cast.slice(0, 10).map(c => ({ id: c.id, name: c.name, character: c.character }));

                            const kws = (details.keywords && details.keywords.keywords) || [];
                            film.keywords = kws.map(k => k.name);

                            const inProviders = (details['watch/providers'] && details['watch/providers'].results && details['watch/providers'].results.IN) || {};
                            film.watch_providers = {
                                flatrate: (inProviders.flatrate || []).map(p => ({ name: p.provider_name, logo: p.logo_path })),
                                rent: (inProviders.rent || []).map(p => ({ name: p.provider_name, logo: p.logo_path })),
                                buy: (inProviders.buy || []).map(p => ({ name: p.provider_name, logo: p.logo_path }))
                            };
                        }
                    }
                } catch {}

                completed++;
                if (onProgress) {
                    onProgress(completed, total, film.title);
                }
            }
        }

        const workers = [];
        for (let w = 0; w < Math.min(concurrency, films.length); w++) {
            workers.push(worker());
        }
        await Promise.all(workers);
        return films;
    }

    function computeRecommendations(films) {
        const liked = films.filter(f => f.rating != null && f.rating >= 4.0 && f.tmdb_id);
        const candidates = films.filter(f => !f.in_diary && (!f.watched_dates || f.watched_dates.length === 0) && f.tmdb_id);

        function jaccard(s1, s2) {
            if (!s1.size && !s2.size) return 0;
            const inter = new Set([...s1].filter(x => s2.has(x))).size;
            const union = new Set([...s1, ...s2]).size;
            return union ? inter / union : 0;
        }

        const recs = [];
        for (const c of candidates) {
            const cG = new Set(c.genres || []);
            const cK = new Set(c.keywords || []);
            const cD = new Set((c.directors || []).map(d => d.id));
            const cC = new Set((c.cast || []).slice(0, 5).map(ca => ca.id));

            let maxScore = 0;
            let bestBecause = [];
            let bestReasons = [];

            for (const l of liked) {
                const lG = new Set(l.genres || []);
                const lK = new Set(l.keywords || []);
                const lD = new Set((l.directors || []).map(d => d.id));
                const lC = new Set((l.cast || []).slice(0, 5).map(ca => ca.id));

                const sG = jaccard(cG, lG);
                const sK = jaccard(cK, lK);
                const sD = [...cD].some(d => lD.has(d)) ? 1 : 0;
                const sC = jaccard(cC, lC);

                const score = (0.30 * sG) + (0.35 * sK) + (0.20 * sD) + (0.15 * sC);
                if (score > maxScore) {
                    maxScore = score;
                    bestBecause = [l.title];
                    const reasons = [];
                    const sharedG = [...cG].filter(x => lG.has(x));
                    if (sharedG.length) reasons.push(`Shares genres: ${sharedG.join(', ')}`);
                    if (sD > 0) {
                        const dirNames = (c.directors || []).filter(d => lD.has(d.id)).map(d => d.name);
                        if (dirNames.length) reasons.push(`Same director: ${dirNames.join(', ')}`);
                    }
                    bestReasons = reasons;
                } else if (score === maxScore && score > 0) {
                    bestBecause.push(l.title);
                }
            }

            if (maxScore > 0) {
                recs.push({
                    tmdb_id: c.tmdb_id,
                    title: c.title,
                    year: c.year,
                    poster: c.poster,
                    genres: c.genres || [],
                    overview: c.overview || '',
                    score: Math.round(maxScore * 10000) / 10000,
                    reasons: bestReasons,
                    because: bestBecause
                });
            }
        }

        recs.sort((a, b) => b.score - a.score);
        return recs.slice(0, 50);
    }

    async function parseCSVText(csvText) {
        return new Promise((resolve) => {
            if (typeof Papa !== 'undefined') {
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => resolve(results.data || [])
                });
            } else {
                resolve([]);
            }
        });
    }

    async function processFiles(fileList) {
        const progressEl = document.getElementById('dropdown-progress');
        const textEl = document.getElementById('dropdown-progress-text');
        const pctEl = document.getElementById('dropdown-progress-pct');
        const fillEl = document.getElementById('dropdown-progress-fill');

        function updateProgress(text, pct) {
            if (progressEl) {
                progressEl.classList.remove('hidden');
                progressEl.style.display = 'block';
            }
            if (textEl) textEl.textContent = text;
            if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
            if (fillEl) fillEl.style.width = `${pct}%`;
        }

        updateProgress('Reading files...', 5);

        const csvDataMap = {};
        let profileData = null;

        for (const file of fileList) {
            if (file.name.endsWith('.zip')) {
                if (typeof JSZip === 'undefined') {
                    alert('JSZip library not loaded. Please ensure you are connected to internet.');
                    return;
                }
                updateProgress('Extracting ZIP archive...', 10);
                const zip = await JSZip.loadAsync(file);

                for (const relativePath of Object.keys(zip.files)) {
                    const zipEntry = zip.files[relativePath];
                    if (zipEntry.dir) continue;
                    const baseName = relativePath.split('/').pop().toLowerCase();
                    if (baseName.endsWith('.csv')) {
                        const content = await zipEntry.async('text');
                        csvDataMap[baseName] = await parseCSVText(content);
                    }
                }
            } else if (file.name.endsWith('.csv')) {
                const baseName = file.name.toLowerCase();
                const content = await file.text();
                csvDataMap[baseName] = await parseCSVText(content);
            }
        }

        // Parse Profile
        if (csvDataMap['profile.csv'] && csvDataMap['profile.csv'].length > 0) {
            const pRow = csvDataMap['profile.csv'][0];
            const favs = (pRow['Favorite Films'] || '').split(',').map(s => s.trim()).filter(Boolean);
            profileData = {
                username: pRow.Username || '',
                given_name: pRow['Given Name'] || '',
                family_name: pRow['Family Name'] || '',
                date_joined: pRow['Date Joined'] || '',
                bio: pRow.Bio || '',
                website: pRow.Website || '',
                location: pRow.Location || '',
                pronoun: pRow.Pronoun || '',
                favorite_films: favs
            };
        }

        // Build raw film list
        const filmMap = {};
        function getFilmKey(title, year) {
            return `${(title || '').trim().toLowerCase()}___${(year || '').toString().trim()}`;
        }

        function ensureFilm(row) {
            const name = (row.Name || '').trim();
            if (!name) return null;
            const yearStr = (row.Year || '').toString().trim();
            const year = yearStr && !isNaN(yearStr) ? parseInt(yearStr, 10) : null;
            const key = getFilmKey(name, year);

            if (!filmMap[key]) {
                filmMap[key] = {
                    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    title: name,
                    year: year,
                    letterboxd_uri: row['Letterboxd URI'] || '',
                    rating: null,
                    watched_dates: new Set(),
                    rewatch: false,
                    review: '',
                    tags: new Set(),
                    liked: false,
                    in_watchlist: false,
                    in_diary: false,
                    tmdb_id: null
                };
            }
            return filmMap[key];
        }

        if (csvDataMap['diary.csv']) {
            csvDataMap['diary.csv'].forEach(row => {
                const f = ensureFilm(row);
                if (!f) return;
                f.in_diary = true;
                if (row.Rating) {
                    const r = parseFloat(row.Rating);
                    if (!isNaN(r)) f.rating = r;
                }
                if (row['Watched Date']) f.watched_dates.add(row['Watched Date']);
                if (row.Rewatch && row.Rewatch.toLowerCase() === 'yes') f.rewatch = true;
                if (row.Tags) {
                    row.Tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => f.tags.add(t));
                }
            });
        }

        if (csvDataMap['ratings.csv']) {
            csvDataMap['ratings.csv'].forEach(row => {
                const f = ensureFilm(row);
                if (!f) return;
                if (row.Rating) {
                    const r = parseFloat(row.Rating);
                    if (!isNaN(r)) f.rating = r;
                }
                if (row.Date) f.watched_dates.add(row.Date);
            });
        }

        if (csvDataMap['watched.csv']) {
            csvDataMap['watched.csv'].forEach(row => {
                const f = ensureFilm(row);
                if (!f) return;
                const d = row['Watched Date'] || row.Date;
                if (d) f.watched_dates.add(d);
            });
        }

        if (csvDataMap['watchlist.csv']) {
            csvDataMap['watchlist.csv'].forEach(row => {
                const f = ensureFilm(row);
                if (!f) return;
                f.in_watchlist = true;
            });
        }

        if (csvDataMap['reviews.csv']) {
            csvDataMap['reviews.csv'].forEach(row => {
                const f = ensureFilm(row);
                if (!f) return;
                f.review = row.Review || '';
                if (row.Rating) {
                    const r = parseFloat(row.Rating);
                    if (!isNaN(r)) f.rating = r;
                }
                const d = row['Watched Date'] || row.Date;
                if (d) f.watched_dates.add(d);
                if (row.Rewatch && row.Rewatch.toLowerCase() === 'yes') f.rewatch = true;
                if (row.Tags) {
                    row.Tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => f.tags.add(t));
                }
            });
        }

        const rawFilms = Object.values(filmMap).map(f => ({
            ...f,
            watched_dates: Array.from(f.watched_dates).sort(),
            tags: Array.from(f.tags).sort(),
            liked: f.rating != null && f.rating >= 4.0
        }));

        if (rawFilms.length === 0) {
            alert('No film records found in uploaded file(s).');
            if (progressEl) progressEl.style.display = 'none';
            return;
        }

        updateProgress(`Found ${rawFilms.length} films. Enriching metadata...`, 15);

        // Enrich with TMDb
        await enrichFilmsConcurrently(rawFilms, (done, total, currentTitle) => {
            const pct = 15 + Math.round((done / total) * 75);
            updateProgress(`Syncing (${done}/${total}): ${currentTitle}`, pct);
        });

        updateProgress('Generating personal picks...', 94);
        const recommendations = computeRecommendations(rawFilms);

        const fullDataset = {
            meta: {
                generated_at: new Date().toISOString(),
                total_watched: rawFilms.filter(f => (f.watched_dates && f.watched_dates.length > 0) || f.in_diary).length,
                total_watchlist: rawFilms.filter(f => f.in_watchlist).length,
                total_rated: rawFilms.filter(f => f.rating != null).length,
                tmdb_region: 'IN',
                profile: profileData || (window.CineData.meta ? window.CineData.meta.profile : null)
            },
            films: rawFilms,
            recommendations: recommendations
        };

        updateProgress('Archive updated! Loading...', 100);

        try {
            localStorage.setItem('boxd_custom_data', JSON.stringify(fullDataset));
        } catch (e) {
            console.warn('LocalStorage full, active session in memory only:', e);
        }

        window.CineData.films = fullDataset.films;
        window.CineData.recommendations = fullDataset.recommendations;
        window.CineData.meta = fullDataset.meta;

        setTimeout(() => {
            if (progressEl) {
                progressEl.classList.add('hidden');
                progressEl.style.display = 'none';
            }
            closeDropdown();
            if (window.onCustomDataLoaded) {
                window.onCustomDataLoaded();
            }
        }, 600);
    }

    function openDropdown() {
        const dd = document.getElementById('upload-dropdown');
        if (dd) {
            dd.classList.remove('hidden');
            dd.style.display = 'block';
        }
    }

    function closeDropdown() {
        const dd = document.getElementById('upload-dropdown');
        if (dd) {
            dd.classList.add('hidden');
            dd.style.display = 'none';
        }
    }

    function toggleDropdown() {
        const dd = document.getElementById('upload-dropdown');
        if (dd) {
            if (dd.style.display === 'block' || !dd.classList.contains('hidden')) {
                closeDropdown();
            } else {
                openDropdown();
            }
        }
    }

    function initEvents() {
        const btnPlus = document.getElementById('btn-plus-upload');
        const btnClose = document.getElementById('dropdown-close');
        const dropZone = document.getElementById('dropdown-drop-zone');
        const fileInput = document.getElementById('dropdown-file-input');
        const btnBrowse = document.getElementById('btn-browse-clean');

        if (btnPlus) {
            btnPlus.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleDropdown();
            });
        }

        if (btnClose) {
            btnClose.addEventListener('click', (e) => {
                e.stopPropagation();
                closeDropdown();
            });
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
            const dd = document.getElementById('upload-dropdown');
            const wrapper = document.querySelector('.header-upload-wrapper');
            if (dd && wrapper && !wrapper.contains(e.target)) {
                closeDropdown();
            }
        });

        if (btnBrowse && fileInput) {
            btnBrowse.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.click();
            });
        }

        if (dropZone && fileInput) {
            dropZone.addEventListener('click', () => {
                fileInput.click();
            });

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    processFiles(e.dataTransfer.files);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    processFiles(e.target.files);
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', initEvents);

    window.BoxdImporter = {
        openDropdown,
        closeDropdown,
        toggleDropdown,
        processFiles
    };
})();
