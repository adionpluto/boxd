window.chartInstances = {};

function destroyCharts() {
    Object.values(window.chartInstances).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    window.chartInstances = {};
}

function getCommonOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            x: {
                grid: { color: '#242C34', drawBorder: false },
                ticks: { color: '#8E9BAE', font: { family: 'Inter', size: 11 } }
            },
            y: {
                grid: { color: '#242C34', drawBorder: false },
                ticks: { color: '#8E9BAE', font: { family: 'Inter', size: 11 } }
            }
        }
    };
}

function slugify(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function getPosterUrl(posterPath, size = 'w342') {
    if (!posterPath) return '';
    if (posterPath.startsWith('http')) return posterPath;
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

// 1. KPI Summary Cards
function renderSummaryCards(films) {
    const totalFilms = films.length;
    const totalMinutes = films.reduce((sum, f) => sum + (f.runtime || 0), 0);
    const hoursWatched = Math.floor(totalMinutes / 60);
    const daysWatched = (hoursWatched / 24).toFixed(1);
    
    const ratedFilms = films.filter(f => f.rating != null);
    const avgRating = ratedFilms.length ? (ratedFilms.reduce((sum, f) => sum + f.rating, 0) / ratedFilms.length).toFixed(2) : 'N/A';
    
    const countries = new Set();
    films.forEach(f => f.countries && f.countries.forEach(c => countries.add(c.name || c.code)));
    const totalCountries = countries.size;
    
    const genres = new Set();
    films.forEach(f => f.genres && f.genres.forEach(g => genres.add(g)));
    const totalGenres = genres.size;

    const container = document.getElementById('summary-cards');
    if (!container) return;
    container.innerHTML = `
        <div class="summary-card">
            <div class="summary-icon">🎬</div>
            <div class="summary-value">${totalFilms.toLocaleString()}</div>
            <div class="summary-label">Total Films</div>
        </div>
        <div class="summary-card">
            <div class="summary-icon">⏱</div>
            <div class="summary-value">${hoursWatched.toLocaleString()} <span class="summary-sub-unit">(${daysWatched}d)</span></div>
            <div class="summary-label">Hours Watched</div>
        </div>
        <div class="summary-card">
            <div class="summary-icon">⭐</div>
            <div class="summary-value">${avgRating} ★</div>
            <div class="summary-label">Avg Rating (${ratedFilms.length} rated)</div>
        </div>
        <div class="summary-card">
            <div class="summary-icon">🌍</div>
            <div class="summary-value">${totalCountries}</div>
            <div class="summary-label">Countries</div>
        </div>
        <div class="summary-card">
            <div class="summary-icon">🎭</div>
            <div class="summary-value">${totalGenres}</div>
            <div class="summary-label">Genres</div>
        </div>
    `;
}

// 2. Letterboxd Milestones (First, Latest, Longest, Shortest, Peak Decade)
function renderMilestones(films) {
    const container = document.getElementById('stats-milestones');
    if (!container) return;

    // Filter films with valid watch dates
    const datedFilms = films.filter(f => f.watched_dates && f.watched_dates.length > 0)
        .map(f => ({ ...f, firstWatch: f.watched_dates[0], lastWatch: f.watched_dates[f.watched_dates.length - 1] }))
        .sort((a, b) => a.firstWatch.localeCompare(b.firstWatch));

    const firstLogged = datedFilms.length ? datedFilms[0] : null;
    const latestLogged = datedFilms.length ? datedFilms[datedFilms.length - 1] : null;

    // Runtime extremes
    const filmsWithRuntime = films.filter(f => f.runtime && f.runtime > 0).sort((a, b) => b.runtime - a.runtime);
    const longest = filmsWithRuntime.length ? filmsWithRuntime[0] : null;
    const shortest = filmsWithRuntime.length ? filmsWithRuntime[filmsWithRuntime.length - 1] : null;

    // Peak Decade
    const decadeCounts = {};
    films.forEach(f => {
        if (f.year) {
            const dec = Math.floor(f.year / 10) * 10;
            decadeCounts[`${dec}s`] = (decadeCounts[`${dec}s`] || 0) + 1;
        }
    });
    const peakDecadeEntry = Object.entries(decadeCounts).sort((a, b) => b[1] - a[1])[0];

    function createMilestoneItem(label, film, extraVal, icon) {
        if (!film) return '';
        const uri = film.letterboxd_uri || `https://letterboxd.com/film/${slugify(film.title)}/`;
        const poster = film.poster ? `<img src="${getPosterUrl(film.poster, 'w185')}" alt="" class="milestone-poster">` : `<div class="milestone-placeholder">${icon}</div>`;
        return `
            <a class="milestone-card" href="${uri}" target="_blank" rel="noopener noreferrer" title="View ${film.title} on Letterboxd">
                <div class="milestone-poster-wrap">${poster}</div>
                <div class="milestone-info">
                    <span class="milestone-tag">${label}</span>
                    <h4 class="milestone-title">${film.title}</h4>
                    <span class="milestone-meta">${extraVal}</span>
                </div>
            </a>
        `;
    }

    let milestonesHtml = '';
    if (firstLogged) {
        milestonesHtml += createMilestoneItem('First Logged', firstLogged, firstLogged.firstWatch, '🏁');
    }
    if (latestLogged) {
        milestonesHtml += createMilestoneItem('Latest Logged', latestLogged, latestLogged.lastWatch, '✨');
    }
    if (longest) {
        const hrs = Math.floor(longest.runtime / 60);
        const mins = longest.runtime % 60;
        milestonesHtml += createMilestoneItem('Longest Film', longest, `${hrs}h ${mins}m (${longest.runtime}m)`, '⏳');
    }
    if (shortest) {
        milestonesHtml += createMilestoneItem('Shortest Film', shortest, `${shortest.runtime} mins`, '⚡');
    }
    if (peakDecadeEntry) {
        const decSlug = peakDecadeEntry[0];
        milestonesHtml += `
            <a class="milestone-card milestone-stat-only" href="https://letterboxd.com/films/decade/${decSlug}/" target="_blank" rel="noopener noreferrer" title="Browse ${decSlug} on Letterboxd">
                <div class="milestone-stat-icon">📅</div>
                <div class="milestone-info">
                    <span class="milestone-tag">Top Decade</span>
                    <h4 class="milestone-title">${decSlug}</h4>
                    <span class="milestone-meta">${peakDecadeEntry[1]} films watched</span>
                </div>
            </a>
        `;
    }

    container.innerHTML = milestonesHtml;
}

// 3. Highest Rated Films (5★ & Top Rated Showcase)
function renderHighestRatedFilms(films) {
    const container = document.getElementById('stats-top-rated-grid');
    if (!container) return;

    // Filter films with 4.5 or 5.0 rating, sorted by rating descending then year descending
    const topRated = films.filter(f => f.rating != null && f.rating >= 4.5)
        .sort((a, b) => (b.rating - a.rating) || ((b.year || 0) - (a.year || 0)))
        .slice(0, 12);

    if (!topRated.length) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No 4.5★ or 5★ ratings logged yet.</p>`;
        return;
    }

    container.innerHTML = topRated.map(film => {
        const uri = film.letterboxd_uri || `https://letterboxd.com/film/${slugify(film.title)}/`;
        const posterUrl = getPosterUrl(film.poster, 'w342');
        const posterHtml = posterUrl 
            ? `<img src="${posterUrl}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="fav-poster-fallback">${film.title}</div>`;

        return `
            <a class="top-rated-film-card" href="${uri}" target="_blank" rel="noopener noreferrer" title="${film.title} (${film.year || ''}) — ★ ${film.rating.toFixed(1)}">
                <div class="top-rated-poster-box">
                    ${posterHtml}
                    <div class="top-rated-badge">★ ${film.rating.toFixed(1)}</div>
                </div>
                <span class="top-rated-title">${film.title}</span>
                <span class="top-rated-year">${film.year || ''}</span>
            </a>
        `;
    }).join('');
}

// 4. Most Watched Directors (Rich Letterboxd Multi-Card View)
function renderTopDirectorsCards(films) {
    const container = document.getElementById('stats-directors-cards');
    if (!container) return;

    const dirMap = {};
    films.forEach(film => {
        if (film.directors && Array.isArray(film.directors)) {
            film.directors.forEach(d => {
                if (d.name) {
                    if (!dirMap[d.name]) {
                        dirMap[d.name] = { id: d.id, name: d.name, films: [] };
                    }
                    dirMap[d.name].films.push(film);
                }
            });
        }
    });

    const sortedDirs = Object.values(dirMap)
        .sort((a, b) => b.films.length - a.films.length)
        .slice(0, 8);

    if (!sortedDirs.length) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No director data available.</p>`;
        return;
    }

    container.innerHTML = sortedDirs.map(d => {
        const lbUri = `https://letterboxd.com/director/${slugify(d.name)}/`;
        const ratedFilms = d.films.filter(f => f.rating != null);
        const avg = ratedFilms.length ? (ratedFilms.reduce((acc, f) => acc + f.rating, 0) / ratedFilms.length).toFixed(1) : null;
        
        // Show up to 5 poster thumbnails of their films
        const posterItems = d.films.slice(0, 5).map(f => {
            const fUri = f.letterboxd_uri || `https://letterboxd.com/film/${slugify(f.title)}/`;
            const pUrl = getPosterUrl(f.poster, 'w185');
            return `
                <a class="person-film-thumb" href="${fUri}" target="_blank" rel="noopener noreferrer" title="${f.title} (${f.year || ''})">
                    ${pUrl ? `<img src="${pUrl}" alt="" loading="lazy">` : `<div class="person-thumb-fallback">${f.title}</div>`}
                </a>
            `;
        }).join('');

        return `
            <div class="person-stat-card">
                <div class="person-header">
                    <a class="person-name-link" href="${lbUri}" target="_blank" rel="noopener noreferrer" title="View ${d.name} on Letterboxd">
                        <h4>${d.name} <span class="ext-arrow">↗</span></h4>
                    </a>
                    <div class="person-metrics">
                        <span class="person-count-badge"><strong>${d.films.length}</strong> ${d.films.length === 1 ? 'film' : 'films'}</span>
                        ${avg ? `<span class="person-avg-badge">★ ${avg} avg</span>` : ''}
                    </div>
                </div>
                <div class="person-films-row">${posterItems}</div>
            </div>
        `;
    }).join('');
}

// 5. Most Watched Cast (Rich Letterboxd Multi-Card View)
function renderTopActorsCards(films) {
    const container = document.getElementById('stats-actors-cards');
    if (!container) return;

    const actorMap = {};
    films.forEach(film => {
        if (film.cast && Array.isArray(film.cast)) {
            film.cast.slice(0, 8).forEach(a => {
                if (a.name) {
                    if (!actorMap[a.name]) {
                        actorMap[a.name] = { id: a.id, name: a.name, films: [] };
                    }
                    actorMap[a.name].films.push(film);
                }
            });
        }
    });

    const sortedActors = Object.values(actorMap)
        .sort((a, b) => b.films.length - a.films.length)
        .slice(0, 8);

    if (!sortedActors.length) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No cast data available.</p>`;
        return;
    }

    container.innerHTML = sortedActors.map(a => {
        const lbUri = `https://letterboxd.com/actor/${slugify(a.name)}/`;
        const ratedFilms = a.films.filter(f => f.rating != null);
        const avg = ratedFilms.length ? (ratedFilms.reduce((acc, f) => acc + f.rating, 0) / ratedFilms.length).toFixed(1) : null;
        
        const posterItems = a.films.slice(0, 5).map(f => {
            const fUri = f.letterboxd_uri || `https://letterboxd.com/film/${slugify(f.title)}/`;
            const pUrl = getPosterUrl(f.poster, 'w185');
            return `
                <a class="person-film-thumb" href="${fUri}" target="_blank" rel="noopener noreferrer" title="${f.title} (${f.year || ''})">
                    ${pUrl ? `<img src="${pUrl}" alt="" loading="lazy">` : `<div class="person-thumb-fallback">${f.title}</div>`}
                </a>
            `;
        }).join('');

        return `
            <div class="person-stat-card">
                <div class="person-header">
                    <a class="person-name-link" href="${lbUri}" target="_blank" rel="noopener noreferrer" title="View ${a.name} on Letterboxd">
                        <h4>${a.name} <span class="ext-arrow">↗</span></h4>
                    </a>
                    <div class="person-metrics">
                        <span class="person-count-badge"><strong>${a.films.length}</strong> ${a.films.length === 1 ? 'film' : 'films'}</span>
                        ${avg ? `<span class="person-avg-badge">★ ${avg} avg</span>` : ''}
                    </div>
                </div>
                <div class="person-films-row">${posterItems}</div>
            </div>
        `;
    }).join('');
}

// 6. Decades Breakdown
function renderDecadesBreakdown(films) {
    const container = document.getElementById('stats-decades-list');
    if (!container) return;

    const decadeStats = {};
    films.forEach(f => {
        if (f.year) {
            const dec = Math.floor(f.year / 10) * 10;
            const key = `${dec}s`;
            if (!decadeStats[key]) {
                decadeStats[key] = { decade: dec, label: key, films: [] };
            }
            decadeStats[key].films.push(f);
        }
    });

    const sortedDecades = Object.values(decadeStats).sort((a, b) => b.decade - a.decade);
    const maxCount = Math.max(...sortedDecades.map(d => d.films.length), 1);

    container.innerHTML = sortedDecades.map(d => {
        const lbUri = `https://letterboxd.com/films/decade/${d.label}/`;
        const pct = Math.round((d.films.length / maxCount) * 100);
        const rated = d.films.filter(f => f.rating != null);
        const avg = rated.length ? (rated.reduce((acc, f) => acc + f.rating, 0) / rated.length).toFixed(1) : '-';

        return `
            <a class="breakdown-row-link" href="${lbUri}" target="_blank" rel="noopener noreferrer" title="Browse ${d.label} films on Letterboxd">
                <div class="breakdown-name">${d.label}</div>
                <div class="breakdown-bar-wrap">
                    <div class="breakdown-bar-fill" style="width: ${pct}%;"></div>
                </div>
                <div class="breakdown-meta">
                    <span class="breakdown-count"><strong>${d.films.length}</strong></span>
                    <span class="breakdown-avg">★ ${avg}</span>
                </div>
            </a>
        `;
    }).join('');
}

// 7. Genres Breakdown
function renderGenresBreakdown(films) {
    const container = document.getElementById('stats-genres-list');
    if (!container) return;

    const genreStats = {};
    films.forEach(f => {
        if (f.genres && Array.isArray(f.genres)) {
            f.genres.forEach(g => {
                if (!genreStats[g]) genreStats[g] = { name: g, films: [] };
                genreStats[g].films.push(f);
            });
        }
    });

    const sortedGenres = Object.values(genreStats).sort((a, b) => b.films.length - a.films.length).slice(0, 10);
    const maxCount = Math.max(...sortedGenres.map(g => g.films.length), 1);

    container.innerHTML = sortedGenres.map(g => {
        const lbUri = `https://letterboxd.com/films/genre/${slugify(g.name)}/`;
        const pct = Math.round((g.films.length / maxCount) * 100);
        const rated = g.films.filter(f => f.rating != null);
        const avg = rated.length ? (rated.reduce((acc, f) => acc + f.rating, 0) / rated.length).toFixed(1) : '-';

        return `
            <a class="breakdown-row-link" href="${lbUri}" target="_blank" rel="noopener noreferrer" title="Browse ${g.name} films on Letterboxd">
                <div class="breakdown-name">${g.name}</div>
                <div class="breakdown-bar-wrap">
                    <div class="breakdown-bar-fill" style="width: ${pct}%;"></div>
                </div>
                <div class="breakdown-meta">
                    <span class="breakdown-count"><strong>${g.films.length}</strong></span>
                    <span class="breakdown-avg">★ ${avg}</span>
                </div>
            </a>
        `;
    }).join('');
}

// 8. Countries Breakdown
function renderCountriesBreakdown(films) {
    const container = document.getElementById('stats-countries-list');
    if (!container) return;

    const countryStats = {};
    films.forEach(f => {
        if (f.countries && Array.isArray(f.countries)) {
            f.countries.forEach(c => {
                const name = c.name;
                if (name) {
                    if (!countryStats[name]) countryStats[name] = { name, code: c.code, films: [] };
                    countryStats[name].films.push(f);
                }
            });
        }
    });

    const sorted = Object.values(countryStats).sort((a, b) => b.films.length - a.films.length).slice(0, 10);
    const maxCount = Math.max(...sorted.map(c => c.films.length), 1);

    container.innerHTML = sorted.map(c => {
        const lbUri = `https://letterboxd.com/films/country/${slugify(c.name)}/`;
        const pct = Math.round((c.films.length / maxCount) * 100);

        return `
            <a class="breakdown-row-link" href="${lbUri}" target="_blank" rel="noopener noreferrer" title="Browse films from ${c.name} on Letterboxd">
                <div class="breakdown-name">${c.name}</div>
                <div class="breakdown-bar-wrap">
                    <div class="breakdown-bar-fill" style="width: ${pct}%;"></div>
                </div>
                <div class="breakdown-meta">
                    <span class="breakdown-count"><strong>${c.films.length}</strong> films</span>
                </div>
            </a>
        `;
    }).join('');
}

// 9. Languages Breakdown
function renderLanguagesBreakdown(films) {
    const container = document.getElementById('stats-languages-list');
    if (!container) return;

    const langStats = {};
    films.forEach(f => {
        if (f.languages && Array.isArray(f.languages)) {
            f.languages.forEach(l => {
                const name = l.name;
                if (name) {
                    if (!langStats[name]) langStats[name] = { name, films: [] };
                    langStats[name].films.push(f);
                }
            });
        }
    });

    const sorted = Object.values(langStats).sort((a, b) => b.films.length - a.films.length).slice(0, 10);
    const maxCount = Math.max(...sorted.map(l => l.films.length), 1);

    container.innerHTML = sorted.map(l => {
        const lbUri = `https://letterboxd.com/films/language/${slugify(l.name)}/`;
        const pct = Math.round((l.films.length / maxCount) * 100);

        return `
            <a class="breakdown-row-link" href="${lbUri}" target="_blank" rel="noopener noreferrer" title="Browse films in ${l.name} on Letterboxd">
                <div class="breakdown-name">${l.name}</div>
                <div class="breakdown-bar-wrap">
                    <div class="breakdown-bar-fill" style="width: ${pct}%;"></div>
                </div>
                <div class="breakdown-meta">
                    <span class="breakdown-count"><strong>${l.films.length}</strong></span>
                </div>
            </a>
        `;
    }).join('');
}

// 10. Letterboxd Patron Divergence (Rated Higher & Lower than Average)
function renderRatingDivergence(films) {
    const higherContainer = document.getElementById('stats-rated-higher');
    const lowerContainer = document.getElementById('stats-rated-lower');

    const ratedFilms = films.filter(f => f.rating != null && f.vote_average != null && f.vote_average > 0);

    const diffs = ratedFilms.map(f => {
        const userOutOfTen = f.rating * 2;
        const diff = userOutOfTen - f.vote_average;
        return { film: f, diff, userRating: f.rating, globalAvg: f.vote_average };
    });

    // Rated Higher
    const higher = diffs.filter(d => d.diff > 1.5).sort((a, b) => b.diff - a.diff).slice(0, 5);
    if (higherContainer) {
        if (!higher.length) {
            higherContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8rem;">No significantly higher ratings.</p>`;
        } else {
            higherContainer.innerHTML = higher.map(item => {
                const f = item.film;
                const uri = f.letterboxd_uri || `https://letterboxd.com/film/${slugify(f.title)}/`;
                return `
                    <a class="divergence-item" href="${uri}" target="_blank" rel="noopener noreferrer" title="View ${f.title} on Letterboxd">
                        <div class="divergence-title-box">
                            <span class="divergence-title">${f.title} (${f.year || ''})</span>
                            <span class="divergence-diff positive">+${item.diff.toFixed(1)} pts</span>
                        </div>
                        <div class="divergence-scores">
                            <span class="score-user">You: ★ ${item.userRating.toFixed(1)}</span>
                            <span class="score-global">TMDb: ${(item.globalAvg / 2).toFixed(1)}★</span>
                        </div>
                    </a>
                `;
            }).join('');
        }
    }

    // Rated Lower
    const lower = diffs.filter(d => d.diff < -1.5).sort((a, b) => a.diff - b.diff).slice(0, 5);
    if (lowerContainer) {
        if (!lower.length) {
            lowerContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8rem;">No significantly lower ratings.</p>`;
        } else {
            lowerContainer.innerHTML = lower.map(item => {
                const f = item.film;
                const uri = f.letterboxd_uri || `https://letterboxd.com/film/${slugify(f.title)}/`;
                return `
                    <a class="divergence-item" href="${uri}" target="_blank" rel="noopener noreferrer" title="View ${f.title} on Letterboxd">
                        <div class="divergence-title-box">
                            <span class="divergence-title">${f.title} (${f.year || ''})</span>
                            <span class="divergence-diff negative">${item.diff.toFixed(1)} pts</span>
                        </div>
                        <div class="divergence-scores">
                            <span class="score-user">You: ★ ${item.userRating.toFixed(1)}</span>
                            <span class="score-global">TMDb: ${(item.globalAvg / 2).toFixed(1)}★</span>
                        </div>
                    </a>
                `;
            }).join('');
        }
    }
}

// 11. Chart.js Graphs
function renderFilmsPerMonth(films) {
    const ctx = document.getElementById('chart-timeline');
    if (!ctx) return;
    
    const now = new Date();
    const months = [];
    for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleDateString('default', { month: 'short', year: '2-digit' }),
            count: 0
        });
    }
    
    films.forEach(f => {
        if (f.watched_dates) {
            f.watched_dates.forEach(dateStr => {
                const parts = dateStr.split('-');
                if (parts.length >= 2) {
                    const key = `${parts[0]}-${parts[1]}`;
                    const m = months.find(x => x.key === key);
                    if (m) m.count++;
                }
            });
        }
    });

    window.chartInstances['timeline'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(m => m.label),
            datasets: [{
                data: months.map(m => m.count),
                backgroundColor: '#00E054',
                borderRadius: 4
            }]
        },
        options: getCommonOptions()
    });
}

function renderRatingDistribution(films) {
    const ctx = document.getElementById('chart-ratings');
    if (!ctx) return;
    
    const counts = new Array(10).fill(0);
    
    films.forEach(f => {
        if (f.rating != null) {
            const idx = Math.round(f.rating * 2) - 1;
            if (idx >= 0 && idx < 10) counts[idx]++;
        }
    });

    window.chartInstances['ratings'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['½★', '1★', '1½★', '2★', '2½★', '3★', '3½★', '4★', '4½★', '5★'],
            datasets: [{
                data: counts,
                backgroundColor: '#FF8000',
                borderRadius: 4
            }]
        },
        options: getCommonOptions()
    });
}

function renderTopGenresChart(films) {
    const ctx = document.getElementById('chart-genres');
    if (!ctx) return;
    
    const genreCounts = {};
    films.forEach(f => {
        if (f.genres) {
            f.genres.forEach(g => {
                genreCounts[g] = (genreCounts[g] || 0) + 1;
            });
        }
    });
    
    const sorted = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7);
        
    window.chartInstances['genres'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(s => s[0]),
            datasets: [{
                data: sorted.map(s => s[1]),
                backgroundColor: '#40BCF4',
                borderRadius: 4
            }]
        },
        options: {
            ...getCommonOptions(),
            indexAxis: 'y'
        }
    });
}

function renderCalendarHeatmap(films) {
    const container = document.getElementById('heatmap-container');
    if (!container) return;
    
    const now = new Date();
    const dateCounts = {};
    
    films.forEach(f => {
        if (f.watched_dates) {
            f.watched_dates.forEach(d => {
                dateCounts[d] = (dateCounts[d] || 0) + 1;
            });
        }
    });
    
    const daysToShow = 52 * 7;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysToShow);
    
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);
    
    const weeks = [];
    let currentWeek = [];
    let curr = new Date(startDate);
    
    while (curr <= now || currentWeek.length > 0) {
        const dateStr = curr.toISOString().split('T')[0];
        const count = dateCounts[dateStr] || 0;
        
        currentWeek.push({ date: dateStr, count });
        
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
        
        curr.setDate(curr.getDate() + 1);
        if (curr > now && currentWeek.length === 0) break;
    }
    
    const cellSize = 11;
    const cellGap = 3;
    const width = weeks.length * (cellSize + cellGap);
    const height = 7 * (cellSize + cellGap) + 20;
    
    let svg = `<svg width="${width}" height="${height}" style="display: block; margin: 0 auto; overflow: visible;">`;
    
    weeks.forEach((week, wIdx) => {
        week.forEach((day, dIdx) => {
            const x = wIdx * (cellSize + cellGap);
            const y = dIdx * (cellSize + cellGap);
            
            let color = '#1E252D';
            if (day.count === 1) color = '#0E703B';
            else if (day.count === 2) color = '#00B84B';
            else if (day.count >= 3) color = '#00E054';
            
            svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${color}">
                <title>${day.date}: ${day.count} films</title>
            </rect>`;
        });
    });
    
    svg += `</svg>`;
    container.innerHTML = svg;
}

function renderTopDirectorsChart(films) {
    const ctx = document.getElementById('chart-directors');
    if (!ctx) return;
    
    const counts = {};
    films.forEach(f => {
        if (f.directors) {
            f.directors.forEach(d => {
                counts[d.name] = (counts[d.name] || 0) + 1;
            });
        }
    });
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7);
    
    window.chartInstances['directors'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(s => s[0]),
            datasets: [{
                data: sorted.map(s => s[1]),
                backgroundColor: '#20D68A',
                borderRadius: 4
            }]
        },
        options: {
            ...getCommonOptions(),
            indexAxis: 'y'
        }
    });
}

function renderTopActorsChart(films) {
    const ctx = document.getElementById('chart-actors');
    if (!ctx) return;
    
    const counts = {};
    films.forEach(f => {
        if (f.cast) {
            f.cast.slice(0, 5).forEach(a => {
                counts[a.name] = (counts[a.name] || 0) + 1;
            });
        }
    });
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7);
    
    window.chartInstances['actors'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(s => s[0]),
            datasets: [{
                data: sorted.map(s => s[1]),
                backgroundColor: '#FF8000',
                borderRadius: 4
            }]
        },
        options: {
            ...getCommonOptions(),
            indexAxis: 'y'
        }
    });
}

function renderFilmsByDecadeChart(films) {
    const ctx = document.getElementById('chart-decades');
    if (!ctx) return;
    
    const decadeCounts = {};
    films.forEach(f => {
        if (f.year) {
            const dec = Math.floor(f.year / 10) * 10;
            decadeCounts[`${dec}s`] = (decadeCounts[`${dec}s`] || 0) + 1;
        }
    });
    
    const sortedKeys = Object.keys(decadeCounts).sort();
    
    window.chartInstances['decades'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedKeys,
            datasets: [{
                data: sortedKeys.map(k => decadeCounts[k]),
                backgroundColor: '#40BCF4',
                borderRadius: 4
            }]
        },
        options: getCommonOptions()
    });
}

function renderAvgRatingOverTime(films) {
    const ctx = document.getElementById('chart-rating-trend');
    if (!ctx) return;
    
    const monthStats = {};
    films.forEach(f => {
        if (f.watched_dates && f.rating != null) {
            f.watched_dates.forEach(dateStr => {
                const parts = dateStr.split('-');
                if (parts.length >= 2) {
                    const key = `${parts[0]}-${parts[1]}`;
                    if (!monthStats[key]) monthStats[key] = { sum: 0, count: 0 };
                    monthStats[key].sum += f.rating;
                    monthStats[key].count++;
                }
            });
        }
    });
    
    const sortedKeys = Object.keys(monthStats).sort();
    const labels = [];
    const data = [];
    
    sortedKeys.forEach(k => {
        const parts = k.split('-');
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
        labels.push(date.toLocaleDateString('default', { month: 'short', year: '2-digit' }));
        data.push(monthStats[k].sum / monthStats[k].count);
    });

    window.chartInstances['rating-trend'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                borderColor: '#FF8000',
                backgroundColor: 'rgba(255, 128, 0, 0.1)',
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: '#FF8000',
                fill: true,
                tension: 0.3
            }]
        },
        options: getCommonOptions()
    });
}

// Master Stats Tab Initializer
window.initCharts = function() {
    const allFilms = window.CineData ? window.CineData.films : [];
    if (!allFilms || allFilms.length === 0) return;

    // Filter to watched films for all-time viewing stats
    const films = allFilms.filter(f => (f.watched_dates && f.watched_dates.length > 0) || f.in_diary);
    if (!films.length) return;

    destroyCharts();
    
    // Core KPIs & Milestones
    renderSummaryCards(films);
    renderMilestones(films);
    renderHighestRatedFilms(films);

    // Visual Charts
    renderFilmsPerMonth(films);
    renderRatingDistribution(films);
    renderCalendarHeatmap(films);
    renderTopGenresChart(films);
    renderTopDirectorsChart(films);
    renderTopActorsChart(films);
    renderFilmsByDecadeChart(films);
    renderAvgRatingOverTime(films);

    // Letterboxd All-Time Person & Category Deep Dives (with direct Letterboxd links)
    renderTopDirectorsCards(films);
    renderTopActorsCards(films);
    renderDecadesBreakdown(films);
    renderGenresBreakdown(films);
    renderCountriesBreakdown(films);
    renderLanguagesBreakdown(films);
    renderRatingDivergence(films);
};
