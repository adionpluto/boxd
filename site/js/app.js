const TMDB_IMG = 'https://image.tmdb.org/t/p/';

window.CineData = {
    films: [],
    recommendations: [],
    meta: null
};

let isDataLoaded = false;
let initializedTabs = new Set();

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    fetchData();
});

async function fetchData() {
    try {
        let data = null;

        // 1. Check if user uploaded custom data stored in localStorage
        const customDataStr = localStorage.getItem('boxd_custom_data');
        if (customDataStr) {
            try {
                data = JSON.parse(customDataStr);
                console.log('Loaded custom user data from browser storage.');
            } catch (e) {
                console.warn('Failed to parse custom storage data, falling back to server json:', e);
            }
        }

        // 2. Otherwise load server enriched.json with cache buster
        if (!data) {
            const response = await fetch('data/enriched.json?v=' + Date.now());
            if (!response.ok) throw new Error('Data not found');
            data = await response.json();
        }

        window.CineData.films = data.films || [];
        window.CineData.recommendations = data.recommendations || [];
        window.CineData.meta = data.meta || null;

        isDataLoaded = true;
        document.getElementById('loading-overlay').classList.add('hidden');
        document.getElementById('error-overlay').classList.add('hidden');

        updateHeaderMeta();
        renderUserProfile();

        // Initialize the default active tab
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            initTabContent(activeTab.dataset.target);
        }

        // Handle hash-based navigation
        handleHash();

    } catch (error) {
        console.error('Failed to load data:', error);
        document.getElementById('loading-overlay').classList.add('hidden');
        document.getElementById('error-overlay').classList.remove('hidden');
    }
}

// Callback invoked when new zip/csv data is uploaded
window.onCustomDataLoaded = function() {
    isDataLoaded = true;
    initializedTabs.clear();
    
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('error-overlay').classList.add('hidden');

    updateHeaderMeta();
    renderUserProfile();

    const activeTab = document.querySelector('.tab.active');
    const tabTarget = activeTab ? activeTab.dataset.target : 'library';
    initTabContent(tabTarget);
};

function renderUserProfile() {
    const meta = window.CineData.meta;
    const profile = meta && meta.profile;
    const heroCardEl = document.getElementById('profile-hero-card');

    if (!profile) {
        if (heroCardEl) heroCardEl.classList.add('hidden');
        return;
    }

    // Stats Profile Hero Card
    if (heroCardEl) {
        const displayName = profile.given_name ? `${profile.given_name} <span class="username">@${profile.username}</span>` : `@${profile.username}`;
        const joinedDate = profile.date_joined ? `Joined ${formatDate(profile.date_joined)}` : '';
        const bioClean = profile.bio ? profile.bio.replace(/<[^>]*>?/gm, ' ').replace(/"/g, '&quot;') : '';

        // Favorite Films Posters lookup
        let favFilmsHtml = '';
        if (profile.favorite_films && profile.favorite_films.length > 0) {
            const favCards = profile.favorite_films.map(uri => {
                const film = window.CineData.films.find(f => f.letterboxd_uri === uri);
                if (film && film.poster) {
                    const posterUrl = film.poster.startsWith('http') ? film.poster : `${TMDB_IMG}w342${film.poster}`;
                    return `
                        <div class="fav-film-item" title="${film.title} (${film.year || ''})" onclick="window.open('${uri}', '_blank')">
                            <img src="${posterUrl}" alt="" loading="lazy" onerror="this.style.display='none'">
                        </div>
                    `;
                }
                return '';
            }).filter(Boolean).join('');

            if (favCards) {
                favFilmsHtml = `
                    <div class="profile-favs-section">
                        <div class="favs-title">Favorite Films</div>
                        <div class="favs-row">${favCards}</div>
                    </div>
                `;
            }
        }

        heroCardEl.innerHTML = `
            <div class="profile-hero-inner">
                <div class="profile-left">
                    <div class="profile-avatar-large">${(profile.given_name || profile.username || 'U')[0].toUpperCase()}</div>
                    <div class="profile-details">
                        <div class="profile-name-row">
                            <h2 class="profile-display-name">${displayName}</h2>
                            <span class="profile-joined-badge">${joinedDate}</span>
                        </div>
                        ${bioClean ? `<p class="profile-bio">&ldquo;${bioClean}&rdquo;</p>` : ''}
                        <div class="profile-stats-mini">
                            <span class="stat-mini-pill"><strong>${(meta.total_watched || 0).toLocaleString()}</strong> Watched</span>
                            <span class="stat-mini-pill"><strong>${(meta.total_rated || 0).toLocaleString()}</strong> Rated</span>
                            <span class="stat-mini-pill"><strong>${(meta.total_watchlist || 0).toLocaleString()}</strong> Watchlist</span>
                        </div>
                    </div>
                </div>
                ${favFilmsHtml}
            </div>
        `;
        heroCardEl.classList.remove('hidden');
    }
}

function formatDate(dateStr) {
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchToTab(e.target.dataset.target);
        });
    });

    // Listen for hash changes
    window.addEventListener('hashchange', handleHash);

    // Listen for filterByCountry custom event from world map
    document.addEventListener('filterByCountry', (e) => {
        switchToTab('library');
        if (window.filterByCountry) {
            window.filterByCountry(e.detail.code);
        }
    });
}

function handleHash() {
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['library', 'stats', 'map', 'watchlist', 'recommendations'];
    if (hash && validTabs.includes(hash)) {
        switchToTab(hash);
    }
}

function switchToTab(targetId) {
    const tabs = document.querySelectorAll('.tab');

    // Update active tab button
    tabs.forEach(t => t.classList.remove('active'));
    const targetTab = document.querySelector(`.tab[data-target="${targetId}"]`);
    if (targetTab) targetTab.classList.add('active');

    // Show the target panel
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(targetId);
    if (panel) panel.classList.add('active');

    // Update URL hash
    window.location.hash = targetId;

    // Initialize tab content if needed
    if (isDataLoaded) {
        initTabContent(targetId);
    }
}

function initTabContent(tabId) {
    if (initializedTabs.has(tabId)) return;

    switch (tabId) {
        case 'library':
            if (window.initFilters) window.initFilters();
            break;
        case 'stats':
            if (window.initCharts) window.initCharts();
            break;
        case 'map':
            if (window.initMap) window.initMap();
            break;
        case 'watchlist':
            initWatchlist();
            break;
        case 'recommendations':
            if (window.initRecommendations) window.initRecommendations();
            break;
    }

    initializedTabs.add(tabId);
}

function updateHeaderMeta() {
    const el = document.getElementById('header-film-count');
    if (window.CineData.meta && el) {
        const count = window.CineData.meta.total_watched || 0;
        el.textContent = `${count.toLocaleString()} films`;
    }
}

function initWatchlist() {
    const watchlist = window.CineData.films.filter(f => f.in_watchlist);
    const countEl = document.getElementById('watchlist-count');
    if (countEl) countEl.textContent = `${watchlist.length} films`;

    const grid = document.getElementById('watchlist-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (watchlist.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 60px 0;">Your watchlist is empty.</p>';
        return;
    }

    watchlist.forEach(film => {
        const card = createWatchlistCard(film);
        grid.appendChild(card);
    });
}

function createWatchlistCard(film) {
    const card = document.createElement('div');
    card.className = 'film-card';
    card.dataset.id = film.id;

    let imageHtml = '';
    if (film.poster) {
        const posterUrl = film.poster.startsWith('http') ? film.poster : `${TMDB_IMG}w500${film.poster}`;
        imageHtml = `
            <img src="${posterUrl}" alt="" loading="lazy" onerror="this.onerror=null;this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';">
            <div class="film-card-placeholder" style="display:none;">${film.title}</div>
        `;
    } else {
        imageHtml = `<div class="film-card-placeholder">${film.title}</div>`;
    }

    // Streaming badges
    let streamingHtml = '';
    const providers = film.watch_providers || {};
    const allProviders = [
        ...(providers.flatrate || []).map(p => ({ ...p, type: 'Stream' })),
        ...(providers.rent || []).map(p => ({ ...p, type: 'Rent' })),
    ];

    if (allProviders.length > 0) {
        const badges = allProviders.slice(0, 3).map(p => {
            const logoUrl = p.logo ? `${TMDB_IMG}w185${p.logo}` : '';
            const logoImg = logoUrl ? `<img src="${logoUrl}" alt="">` : '';
            return `<span class="streaming-badge">${logoImg}${p.name}</span>`;
        }).join('');
        streamingHtml = `<div class="streaming-badges">${badges}</div>`;
    }

    card.innerHTML = `
        ${imageHtml}
        <div class="film-card-overlay" style="opacity:1; background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%);">
            <div class="film-title">${film.title}</div>
            <div class="film-year">${film.year || ''}</div>
            ${streamingHtml}
        </div>
    `;

    return card;
}

// =============================================
// SHARED UTILITIES
// =============================================

window.createFilmCard = function(film) {
    const card = document.createElement('div');
    card.className = 'film-card';
    card.dataset.id = film.id;

    let imageHtml = '';
    if (film.poster) {
        const posterUrl = film.poster.startsWith('http') ? film.poster : `${TMDB_IMG}w500${film.poster}`;
        imageHtml = `
            <img src="${posterUrl}" alt="" loading="lazy" onerror="this.onerror=null;this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';">
            <div class="film-card-placeholder" style="display:none;">${film.title}</div>
        `;
    } else {
        imageHtml = `<div class="film-card-placeholder">${film.title}</div>`;
    }

    let ratingHtml = '';
    if (film.rating) {
        ratingHtml = `<div class="rating-badge">★ ${film.rating.toFixed(1)}</div>`;
    }

    card.innerHTML = `
        ${imageHtml}
        ${ratingHtml}
        <div class="film-card-overlay">
            <div class="film-title">${film.title}</div>
            <div class="film-year">${film.year || ''}</div>
        </div>
    `;

    // Click to open Letterboxd page
    if (film.letterboxd_uri) {
        card.addEventListener('click', () => {
            window.open(film.letterboxd_uri, '_blank');
        });
    }

    return card;
};

window.formatRating = function(n) {
    if (!n) return '';
    const full = Math.floor(n);
    const half = n % 1 !== 0;
    return '★'.repeat(full) + (half ? '½' : '');
};

window.slugify = function(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

window.getPosterUrl = function(path, size) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${TMDB_IMG}${size || 'w500'}${path}`;
};
