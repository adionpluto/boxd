const RECS_TMDB_IMG = 'https://image.tmdb.org/t/p/';
let recIndex = 0;
const RECS_PER_PAGE = 5;

window.initRecommendations = function() {
    const recs = window.CineData.recommendations;
    if (!recs || recs.length === 0) {
        document.getElementById('recommendations-grid').innerHTML = '<p>No recommendations available.</p>';
        return;
    }
    
    renderRecommendations();
    
    document.getElementById('rec-next').addEventListener('click', () => {
        if (recIndex + RECS_PER_PAGE < recs.length) {
            recIndex += RECS_PER_PAGE;
            renderRecommendations();
        }
    });
    
    document.getElementById('rec-prev').addEventListener('click', () => {
        if (recIndex - RECS_PER_PAGE >= 0) {
            recIndex -= RECS_PER_PAGE;
            renderRecommendations();
        }
    });
    
    document.getElementById('rec-shuffle').addEventListener('click', () => {
        recIndex = Math.floor(Math.random() * (recs.length / RECS_PER_PAGE)) * RECS_PER_PAGE;
        if (recIndex >= recs.length) recIndex = 0;
        renderRecommendations();
    });
};

function renderRecommendations() {
    const recs = window.CineData.recommendations;
    const container = document.getElementById('recommendations-grid');
    container.innerHTML = '';
    
    const slice = recs.slice(recIndex, recIndex + RECS_PER_PAGE);
    
    slice.forEach(rec => {
        const posterUrl = rec.poster ? `${RECS_TMDB_IMG}w500${rec.poster}` : '';
        const scorePct = Math.round((rec.score || 0) * 100);
        
        const genresHtml = rec.genres && rec.genres.length > 0 
            ? `<div class="rec-genres">${rec.genres.slice(0, 3).map(g => `<span class="genre-pill">${g}</span>`).join('')}</div>` 
            : '';

        const reasonsHtml = rec.reasons && rec.reasons.length > 0
            ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${rec.reasons.slice(0, 2).join(' • ')}</div>`
            : '';

        const card = document.createElement('div');
        card.className = 'rec-card';
        card.innerHTML = `
            <div class="rec-poster">
                ${posterUrl 
                    ? `<img src="${posterUrl}" alt="${rec.title}" loading="lazy" onerror="this.onerror=null;this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';">
                       <div class="film-card-placeholder" style="display:none;">${rec.title}</div>`
                    : `<div class="film-card-placeholder">${rec.title}</div>`
                }
            </div>
            <div class="rec-info">
                <h3>${rec.title} <span class="film-year">(${rec.year || ''})</span></h3>
                <div class="rec-score">${scorePct}% Match</div>
                ${genresHtml}
                ${rec.because && rec.because.length > 0 ? `<p style="margin-top:8px;">Because you liked: <strong style="color: var(--text-primary);">${rec.because.join(', ')}</strong></p>` : ''}
                ${reasonsHtml}
            </div>
        `;
        container.appendChild(card);
    });
    
    // Update pagination
    const start = recIndex + 1;
    const end = Math.min(recIndex + RECS_PER_PAGE, recs.length);
    document.getElementById('rec-page').textContent = `${start}-${end} of ${recs.length}`;
    
    document.getElementById('rec-prev').disabled = recIndex === 0;
    document.getElementById('rec-next').disabled = recIndex + RECS_PER_PAGE >= recs.length;
}
