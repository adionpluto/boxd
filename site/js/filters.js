// Filters and Library rendering logic (Cleaned: Genre, Country, Decade, Language)

window.currentFilters = {
    genres: new Set(),
    countries: new Set(),
    decades: new Set(),
    languages: new Set(),
    sort: 'Date Watched ↓'
};

let allLibraryFilms = [];
let filteredFilms = [];

// Extracted filter data
let filterData = {
    genres: {},
    countries: new Set(),
    decades: new Set(),
    languages: new Set()
};

function getMostRecentWatchDate(film) {
    if (!film.watched_dates || film.watched_dates.length === 0) return '0000-00-00';
    return [...film.watched_dates].sort().pop();
}

function processFilterData() {
    allLibraryFilms = window.CineData.films.filter(f => 
        f.in_diary || (f.watched_dates && f.watched_dates.length > 0) || f.rating !== null
    );

    filterData = {
        genres: {},
        countries: new Set(),
        decades: new Set(),
        languages: new Set()
    };

    allLibraryFilms.forEach(film => {
        // Genres
        if (film.genres) {
            film.genres.forEach(g => {
                filterData.genres[g] = (filterData.genres[g] || 0) + 1;
            });
        }
        // Countries
        if (film.countries) {
            film.countries.forEach(c => filterData.countries.add(c.name));
        }
        // Decades
        if (film.year) {
            const decade = Math.floor(film.year / 10) * 10;
            filterData.decades.add(`${decade}s`);
        }
        // Languages
        if (film.languages) {
            film.languages.forEach(l => filterData.languages.add(l.name));
        }
    });
}

function renderFilters() {
    const container = document.getElementById('filter-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // 1. Genres
    const genreSection = document.createElement('div');
    genreSection.className = 'filter-section';
    genreSection.innerHTML = '<h4>Genres</h4>';
    const genreList = document.createElement('div');
    genreList.className = 'filter-checkboxes';
    
    const sortedGenres = Object.entries(filterData.genres)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(e => e[0]);
    
    let showAllGenres = false;
    
    const renderGenres = () => {
        genreList.innerHTML = '';
        const limit = showAllGenres ? sortedGenres.length : Math.min(15, sortedGenres.length);
        for (let i = 0; i < limit; i++) {
            const g = sortedGenres[i];
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = g;
            checkbox.checked = window.currentFilters.genres.has(g);
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) window.currentFilters.genres.add(g);
                else window.currentFilters.genres.delete(g);
                applyFilters();
            });
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${g} (${filterData.genres[g]})`));
            genreList.appendChild(label);
        }
        
        if (!showAllGenres && sortedGenres.length > 15) {
            const btn = document.createElement('button');
            btn.className = 'filter-text-btn';
            btn.textContent = 'Show all';
            btn.onclick = () => { showAllGenres = true; renderGenres(); };
            genreList.appendChild(btn);
        }
    };
    renderGenres();
    genreSection.appendChild(genreList);
    container.appendChild(genreSection);

    // 2. Country (Searchable Autocomplete)
    const countrySection = document.createElement('div');
    countrySection.className = 'filter-section';
    countrySection.innerHTML = '<h4>Country</h4>';
    const countryWrapper = document.createElement('div');
    countryWrapper.className = 'autocomplete-wrapper';
    const countryInput = document.createElement('input');
    countryInput.type = 'text';
    countryInput.placeholder = 'Search country...';
    const countryDropdown = document.createElement('div');
    countryDropdown.className = 'autocomplete-dropdown';

    countryInput.addEventListener('input', () => {
        const val = countryInput.value.toLowerCase().trim();
        countryDropdown.innerHTML = '';
        if (!val) {
            countryDropdown.style.display = 'none';
            return;
        }
        const matches = Array.from(filterData.countries).filter(c => c.toLowerCase().includes(val)).slice(0, 10);
        if (matches.length > 0) {
            countryDropdown.style.display = 'block';
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.textContent = match;
                div.onclick = () => {
                    window.currentFilters.countries.add(match);
                    countryInput.value = '';
                    countryDropdown.style.display = 'none';
                    applyFilters();
                };
                countryDropdown.appendChild(div);
            });
        } else {
            countryDropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== countryInput) countryDropdown.style.display = 'none';
    });

    countryWrapper.appendChild(countryInput);
    countryWrapper.appendChild(countryDropdown);
    countrySection.appendChild(countryWrapper);
    container.appendChild(countrySection);

    // 3. Decade
    const decadeSection = document.createElement('div');
    decadeSection.className = 'filter-section';
    decadeSection.innerHTML = '<h4>Decade</h4>';
    const decadeList = document.createElement('div');
    decadeList.className = 'filter-toggles';
    Array.from(filterData.decades).sort().forEach(d => {
        const btn = document.createElement('button');
        btn.className = 'toggle-btn' + (window.currentFilters.decades.has(d) ? ' active' : '');
        btn.textContent = d;
        btn.onclick = () => {
            if (window.currentFilters.decades.has(d)) window.currentFilters.decades.delete(d);
            else window.currentFilters.decades.add(d);
            btn.classList.toggle('active');
            applyFilters();
        };
        decadeList.appendChild(btn);
    });
    decadeSection.appendChild(decadeList);
    container.appendChild(decadeSection);

    // 4. Language
    const langSection = document.createElement('div');
    langSection.className = 'filter-section';
    langSection.innerHTML = '<h4>Language</h4>';
    const langSelect = document.createElement('select');
    langSelect.innerHTML = '<option value="">All Languages</option>';
    Array.from(filterData.languages).sort().forEach(l => {
        langSelect.innerHTML += `<option value="${l}">${l}</option>`;
    });
    langSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) window.currentFilters.languages.add(val);
        e.target.value = '';
        if (val) applyFilters();
    });
    langSection.appendChild(langSelect);
    container.appendChild(langSection);

    // Ensure Sort handler is bound
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.value = window.currentFilters.sort;
        sortSelect.onchange = (e) => {
            window.currentFilters.sort = e.target.value;
            applyFilters();
        };
    }
}

function renderActivePills() {
    const container = document.getElementById('active-filters');
    if (!container) return;
    container.innerHTML = '';
    
    let hasFilters = false;

    const addPill = (label, onRemove) => {
        hasFilters = true;
        const pill = document.createElement('div');
        pill.className = 'filter-pill';
        pill.innerHTML = `<span>${label}</span><button>×</button>`;
        pill.querySelector('button').onclick = onRemove;
        container.appendChild(pill);
    };

    window.currentFilters.genres.forEach(g => addPill(`Genre: ${g}`, () => { window.currentFilters.genres.delete(g); applyFilters(); }));
    window.currentFilters.countries.forEach(c => addPill(`Country: ${c}`, () => { window.currentFilters.countries.delete(c); applyFilters(); }));
    window.currentFilters.decades.forEach(d => addPill(`Decade: ${d}`, () => { window.currentFilters.decades.delete(d); applyFilters(); }));
    window.currentFilters.languages.forEach(l => addPill(`Language: ${l}`, () => { window.currentFilters.languages.delete(l); applyFilters(); }));

    const clearBtn = document.getElementById('clear-filters');
    if (clearBtn) {
        clearBtn.style.display = hasFilters ? 'inline-block' : 'none';
        clearBtn.onclick = () => {
            window.currentFilters = {
                genres: new Set(),
                countries: new Set(),
                decades: new Set(),
                languages: new Set(),
                sort: window.currentFilters.sort
            };
            applyFilters();
        };
    }
}

function applyFilters() {
    filteredFilms = allLibraryFilms.filter(film => {
        // Genres (ANY)
        if (window.currentFilters.genres.size > 0) {
            if (!film.genres || !film.genres.some(g => window.currentFilters.genres.has(g))) return false;
        }
        
        // Countries (ANY)
        if (window.currentFilters.countries.size > 0) {
            if (!film.countries || !film.countries.some(c => window.currentFilters.countries.has(c.name) || window.currentFilters.countries.has(c.code))) return false;
        }

        // Decades (ANY)
        if (window.currentFilters.decades.size > 0) {
            if (!film.year) return false;
            const decade = `${Math.floor(film.year / 10) * 10}s`;
            if (!window.currentFilters.decades.has(decade)) return false;
        }

        // Languages (ANY)
        if (window.currentFilters.languages.size > 0) {
            if (!film.languages || !film.languages.some(l => window.currentFilters.languages.has(l.name))) return false;
        }

        return true;
    });

    // Sorting
    filteredFilms.sort((a, b) => {
        switch (window.currentFilters.sort) {
            case 'Date Watched ↓':
                return getMostRecentWatchDate(b).localeCompare(getMostRecentWatchDate(a));
            case 'Rating ↓':
                return (b.rating || 0) - (a.rating || 0);
            case 'Year ↓':
                return (b.year || 0) - (a.year || 0);
            case 'Title A-Z':
                return (a.title || '').localeCompare(b.title || '');
            default:
                return 0;
        }
    });

    renderActivePills();
    renderLibraryGrid();
    renderFilters();
}

function renderLibraryGrid() {
    const grid = document.getElementById('library-grid');
    const count = document.getElementById('results-count');
    
    if (count) {
        count.textContent = `Showing ${filteredFilms.length} of ${allLibraryFilms.length} films`;
    }

    if (!grid) return;
    
    grid.innerHTML = '';
    filteredFilms.forEach(film => {
        if (window.createFilmCard) {
            grid.appendChild(window.createFilmCard(film));
        }
    });
}

window.initFilters = function() {
    processFilterData();
    applyFilters();
};

window.filterByCountry = function(countryCode) {
    window.currentFilters = {
        genres: new Set(),
        countries: new Set(),
        decades: new Set(),
        languages: new Set(),
        sort: 'Date Watched ↓'
    };
    
    let cName = countryCode;
    for (let f of window.CineData.films) {
        if (f.countries) {
            let c = f.countries.find(c => c.code === countryCode || c.code === countryCode.toUpperCase());
            if (c) {
                cName = c.name;
                break;
            }
        }
    }
    
    window.currentFilters.countries.add(cName);
    
    const libTab = document.querySelector('[data-target="library"]') || document.querySelector('[data-tab="library"]');
    if (libTab) libTab.click();
    
    applyFilters();
};
