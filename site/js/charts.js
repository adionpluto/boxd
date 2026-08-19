window.chartInstances = {};

function destroyCharts() {
    Object.values(window.chartInstances).forEach(chart => chart.destroy());
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
                grid: { color: '#2C3440', drawBorder: false },
                ticks: { color: '#E1E3E5' }
            },
            y: {
                grid: { color: '#2C3440', drawBorder: false },
                ticks: { color: '#E1E3E5' }
            }
        }
    };
}

function renderSummaryCards(films) {
    const totalFilms = films.length;
    const totalMinutes = films.reduce((sum, f) => sum + (f.runtime || 0), 0);
    const hoursWatched = Math.floor(totalMinutes / 60);
    
    const ratedFilms = films.filter(f => f.rating != null);
    const avgRating = ratedFilms.length ? (ratedFilms.reduce((sum, f) => sum + f.rating, 0) / ratedFilms.length).toFixed(1) : 'N/A';
    
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
            <div class="summary-value">${totalFilms}</div>
            <div class="summary-label">Total Films</div>
        </div>
        <div class="summary-card">
            <div class="summary-icon">⏱</div>
            <div class="summary-value">${hoursWatched}</div>
            <div class="summary-label">Hours Watched</div>
        </div>
        <div class="summary-card">
            <div class="summary-icon">⭐</div>
            <div class="summary-value">${avgRating}</div>
            <div class="summary-label">Avg Rating</div>
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

function renderCalendarHeatmap(films) {
    const container = document.getElementById('heatmap-container');
    if (!container) return;
    
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 364);
    
    const dailyCounts = {};
    films.forEach(f => {
        if (f.watched_dates) {
            f.watched_dates.forEach(dateStr => {
                dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
            });
        }
    });

    const cellSize = 12;
    const cellGap = 2;
    const weeks = 53;
    const daysInWeek = 7;
    const width = weeks * (cellSize + cellGap) + 30; // 30 for labels
    const height = daysInWeek * (cellSize + cellGap) + 20; // 20 for months

    let svg = `<svg width="100%" viewBox="0 0 ${width} ${height}" style="max-width: 100%; height: auto;">`;
    
    // Day labels
    const dayLabels = ['Mon', 'Wed', 'Fri'];
    const dayOffsets = [1, 3, 5];
    dayLabels.forEach((lbl, i) => {
        const y = 20 + dayOffsets[i] * (cellSize + cellGap) + cellSize - 2;
        svg += `<text x="0" y="${y}" fill="#99AABB" font-size="10" font-family="sans-serif">${lbl}</text>`;
    });

    let currentX = 30;
    let d = new Date(startDate);
    let lastMonth = -1;

    for (let w = 0; w < weeks; w++) {
        let firstDayOfWeek = true;
        for (let i = 0; i < 7; i++) {
            if (d > now) break;
            if (w === 0 && i < d.getDay()) {
                continue;
            }
            
            const month = d.getMonth();
            if (firstDayOfWeek && month !== lastMonth && d.getDate() < 15) {
                const monthName = d.toLocaleDateString('default', { month: 'short' });
                svg += `<text x="${currentX}" y="10" fill="#99AABB" font-size="10" font-family="sans-serif">${monthName}</text>`;
                lastMonth = month;
            }
            firstDayOfWeek = false;

            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const count = dailyCounts[dateStr] || 0;
            
            let color = '#1B2028';
            if (count > 0) {
                const opacity = Math.min(0.2 + (count * 0.2), 1.0);
                color = `rgba(0, 224, 84, ${opacity})`;
            }

            const y = 20 + d.getDay() * (cellSize + cellGap);
            const title = `${d.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}: ${count} film${count !== 1 ? 's' : ''}`;
            
            svg += `<rect x="${currentX}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${color}">
                <title>${title}</title>
            </rect>`;
            
            d.setDate(d.getDate() + 1);
        }
        currentX += cellSize + cellGap;
    }
    
    svg += '</svg>';
    container.innerHTML = svg;
}

function renderTopGenres(films) {
    const ctx = document.getElementById('chart-genres');
    if (!ctx) return;
    
    const counts = {};
    films.forEach(f => {
        if (f.genres) {
            f.genres.forEach(g => counts[g] = (counts[g] || 0) + 1);
        }
    });
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const palette = ['#00E054','#40BCF4','#EE7752','#FF8000','#A855F7','#EC4899','#14B8A6','#F59E0B','#6366F1','#84CC16'];

    window.chartInstances['genres'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(x => x[0]),
            datasets: [{
                data: sorted.map(x => x[1]),
                backgroundColor: palette,
                borderRadius: 4
            }]
        },
        options: {
            ...getCommonOptions(),
            indexAxis: 'y'
        }
    });
}

function renderTopDirectors(films) {
    const ctx = document.getElementById('chart-directors');
    if (!ctx) return;
    
    const counts = {};
    films.forEach(f => {
        if (f.directors) {
            f.directors.forEach(d => counts[d.name] = (counts[d.name] || 0) + 1);
        }
    });
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    window.chartInstances['directors'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(x => x[0]),
            datasets: [{
                data: sorted.map(x => x[1]),
                backgroundColor: '#A855F7',
                borderRadius: 4
            }]
        },
        options: {
            ...getCommonOptions(),
            indexAxis: 'y'
        }
    });
}

function renderTopActors(films) {
    const ctx = document.getElementById('chart-actors');
    if (!ctx) return;
    
    const counts = {};
    films.forEach(f => {
        if (f.cast) {
            f.cast.forEach(c => counts[c.name] = (counts[c.name] || 0) + 1);
        }
    });
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    window.chartInstances['actors'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(x => x[0]),
            datasets: [{
                data: sorted.map(x => x[1]),
                backgroundColor: '#EC4899',
                borderRadius: 4
            }]
        },
        options: {
            ...getCommonOptions(),
            indexAxis: 'y'
        }
    });
}

function renderFilmsByDecade(films) {
    const ctx = document.getElementById('chart-decades');
    if (!ctx) return;
    
    const counts = {};
    films.forEach(f => {
        if (f.year) {
            const decade = Math.floor(f.year / 10) * 10;
            counts[decade] = (counts[decade] || 0) + 1;
        }
    });
    
    const sortedDecades = Object.keys(counts).sort((a, b) => a - b);
    if (sortedDecades.length === 0) return;
    
    const minDecade = parseInt(sortedDecades[0]);
    const maxDecade = parseInt(sortedDecades[sortedDecades.length - 1]);
    
    const labels = [];
    const data = [];
    for (let i = minDecade; i <= maxDecade; i += 10) {
        labels.push(`${i}s`);
        data.push(counts[i] || 0);
    }

    window.chartInstances['decades'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
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

window.initCharts = function() {
    const allFilms = window.CineData ? window.CineData.films : [];
    if (!allFilms || allFilms.length === 0) return;

    // Filter to watched films for accurate viewing statistics
    const films = allFilms.filter(f => (f.watched_dates && f.watched_dates.length > 0) || f.in_diary);
    if (!films.length) return;

    destroyCharts();
    
    renderSummaryCards(films);
    renderFilmsPerMonth(films);
    renderRatingDistribution(films);
    renderCalendarHeatmap(films);
    renderTopGenres(films);
    renderTopDirectors(films);
    renderTopActors(films);
    renderFilmsByDecade(films);
    renderAvgRatingOverTime(films);
};
