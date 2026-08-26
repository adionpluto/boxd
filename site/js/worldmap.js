class WorldMap {
    constructor(containerId, geoData) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        
        this.geoData = geoData;
        this.films = window.CineData && window.CineData.films ? window.CineData.films : [];
        
        // Historical/alternative country code mapping
        this.COUNTRY_ALIASES = {
            "SU": "RU", // Soviet Union -> Russia
            "YU": "RS", // Yugoslavia -> Serbia
            "XI": "GB", // Northern Ireland -> United Kingdom
            "AN": "CW"  // Netherlands Antilles -> Curaçao
        };

        // Count films per country using alpha-2 codes (watched films only)
        this.countryStats = {};
        const watchedFilms = this.films.filter(f => (f.watched_dates && f.watched_dates.length > 0) || f.in_diary);
        watchedFilms.forEach(film => {
            if (film.countries && Array.isArray(film.countries)) {
                film.countries.forEach(c => {
                    if (c.code) {
                        let code = c.code.toUpperCase().trim();
                        if (this.COUNTRY_ALIASES[code]) {
                            code = this.COUNTRY_ALIASES[code];
                        }
                        if (!this.countryStats[code]) {
                            this.countryStats[code] = { count: 0, films: [], name: c.name };
                        }
                        this.countryStats[code].count++;
                        this.countryStats[code].films.push(film);
                    }
                });
            }
        });

        Object.values(this.countryStats).forEach(stat => {
            stat.films.sort((a, b) => {
                const ratingDiff = (b.rating || 0) - (a.rating || 0);
                if (ratingDiff !== 0) return ratingDiff;
                return (b.year || 0) - (a.year || 0);
            });
        });

        this.maxFilms = d3.max(Object.values(this.countryStats), d => d.count) || 1;

        this.initTooltip();
        this.initMap();
        
        this.resizeHandler = this.debounce(() => this.draw(), 200);
        window.addEventListener('resize', this.resizeHandler);
    }

    getCountryColor(count) {
        // Unwatched countries: Always solid sleek dark charcoal slate (matching Letterboxd reference!)
        if (!count || count <= 0) {
            return '#252D37';
        }

        // Watched countries: Authentic Letterboxd vibrant green spectrum
        const maxVal = Math.max(this.maxFilms, 10);
        const t = Math.log(count) / Math.log(maxVal); // Normalized 0.0 to 1.0

        return d3.interpolateRgbBasis([
            '#008C3B', // 1 film: rich solid green
            '#00A846', // 2-5 films
            '#00C44E', // 6-25 films
            '#00E054', // 26-100 films: signature Letterboxd green
            '#24E565'  // 100+ films: luminous bright green
        ])(Math.min(Math.max(t, 0), 1));
    }

    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    initTooltip() {
        this.tooltip = d3.select("body").append("div")
            .attr("class", "worldmap-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "#1B2028")
            .style("color", "#E1E3E5")
            .style("padding", "10px 14px")
            .style("border", "1px solid #3A4450")
            .style("border-radius", "8px")
            .style("pointer-events", "none")
            .style("z-index", "1000")
            .style("box-shadow", "0 6px 16px rgba(0, 0, 0, 0.6)")
            .style("font-family", "'Inter', sans-serif")
            .style("font-size", "13px");
    }

    initMap() {
        this.draw();
    }

    draw() {
        this.container.innerHTML = '';
        
        const width = this.container.clientWidth || 1200;
        const height = this.container.clientHeight || Math.max(window.innerHeight - 150, 600);
        
        const svg = d3.select(this.container).append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("background", "#0C1014");

        // Top centered "WORLD MAP" title like Letterboxd
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", 28)
            .attr("text-anchor", "middle")
            .attr("fill", "#667788")
            .attr("font-size", "11px")
            .attr("font-weight", "700")
            .attr("letter-spacing", "0.15em")
            .text("WORLD MAP");

        // Bottom right attribution
        svg.append("text")
            .attr("x", width - 20)
            .attr("y", height - 16)
            .attr("text-anchor", "end")
            .attr("fill", "#445566")
            .attr("font-size", "10px")
            .text("Map data from UN Geodata simplified");

        const g = svg.append("g");

        // Natural Earth projection
        const projection = d3.geoNaturalEarth1();
        const path = d3.geoPath().projection(projection);

        // Fit UN Geodata FeatureCollection
        const features = this.geoData.features || [];
        projection.fitSize([width - 40, height - 60], this.geoData);
        
        // Center the projection with margin for top title
        g.attr("transform", "translate(20, 20)");

        // Draw countries from UN Geodata
        g.selectAll("path")
            .data(features)
            .enter().append("path")
            .attr("d", path)
            .attr("fill", d => {
                const alpha2 = d.properties && d.properties.iso2 ? d.properties.iso2.toUpperCase() : null;
                const count = alpha2 && this.countryStats[alpha2] ? this.countryStats[alpha2].count : 0;
                return this.getCountryColor(count);
            })
            .attr("stroke", "#101418")
            .attr("stroke-width", "0.6px")
            .style("cursor", "pointer")
            .style("transition", "fill 0.15s ease, stroke 0.15s ease, filter 0.15s ease")
            .on("mouseover", (event, d) => {
                const alpha2 = d.properties && d.properties.iso2 ? d.properties.iso2.toUpperCase() : null;
                const stats = alpha2 ? this.countryStats[alpha2] : null;
                const count = stats?.count || 0;
                
                d3.select(event.currentTarget)
                    .attr("stroke", "#FFFFFF")
                    .attr("stroke-width", "1.6px")
                    .style("filter", count > 0 ? "brightness(1.2)" : "none")
                    .raise();
                
                this.tooltip.style("visibility", "visible");
                
                const countryName = (d.properties && d.properties.name) || stats?.name || alpha2 || "Unknown Region";
                const topTitles = stats ? stats.films.slice(0, 3).map(f => f.title) : [];
                
                let tooltipHtml = `
                    <div style="font-weight: 700; margin-bottom: 4px; color: ${count > 0 ? '#00E054' : '#8899AA'}; font-size: 14px;">${countryName}</div>
                    <div style="margin-bottom: 6px; color: #99AABB;">${count} ${count === 1 ? 'film watched' : 'films watched'}</div>
                `;
                
                if (topTitles.length > 0) {
                    tooltipHtml += `<div style="color: #667788; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Top films:</div>
                                    <ul style="margin: 0; padding-left: 14px; font-size: 12px; color: #E1E3E5; line-height: 1.4;">`;
                    topTitles.forEach(title => {
                        tooltipHtml += `<li>${title}</li>`;
                    });
                    tooltipHtml += `</ul>`;
                }

                this.tooltip.html(tooltipHtml);
            })
            .on("mousemove", (event) => {
                this.tooltip
                    .style("top", (event.pageY + 15) + "px")
                    .style("left", (event.pageX + 15) + "px");
            })
            .on("mouseout", (event, d) => {
                d3.select(event.currentTarget)
                    .attr("stroke", "#101418")
                    .attr("stroke-width", "0.6px")
                    .style("filter", "none");
                
                this.tooltip.style("visibility", "hidden");
            })
            .on("click", (event, d) => {
                const alpha2 = d.properties && d.properties.iso2 ? d.properties.iso2.toUpperCase() : null;
                if (alpha2) {
                    const filterEvent = new CustomEvent('filterByCountry', {
                        detail: { code: alpha2 }
                    });
                    document.dispatchEvent(filterEvent);
                }
            });

        // Zoom buttons in bottom-left
        const zoomWrapper = d3.select(this.container).append("div")
            .attr("class", "map-zoom-controls")
            .style("position", "absolute")
            .style("bottom", "20px")
            .style("left", "20px")
            .style("display", "flex")
            .style("flex-direction", "column")
            .style("gap", "4px")
            .style("z-index", "10");

        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);

        zoomWrapper.append("button")
            .attr("class", "btn-map-zoom")
            .text("+")
            .style("width", "30px")
            .style("height", "30px")
            .style("background", "#192027")
            .style("color", "#99AABB")
            .style("border", "1px solid #2C3540")
            .style("border-radius", "4px")
            .style("font-size", "16px")
            .style("font-weight", "700")
            .style("cursor", "pointer")
            .on("click", () => svg.transition().duration(300).call(zoom.scaleBy, 1.4));

        zoomWrapper.append("button")
            .attr("class", "btn-map-zoom")
            .text("−")
            .style("width", "30px")
            .style("height", "30px")
            .style("background", "#192027")
            .style("color", "#99AABB")
            .style("border", "1px solid #2C3540")
            .style("border-radius", "4px")
            .style("font-size", "16px")
            .style("font-weight", "700")
            .style("cursor", "pointer")
            .on("click", () => svg.transition().duration(300).call(zoom.scaleBy, 0.7));
    }

    destroy() {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this.tooltip) {
            this.tooltip.remove();
        }
    }
}

window.WorldMap = WorldMap;

window.initMap = async function() {
    const container = document.getElementById('world-map');
    if (!container || container.querySelector('svg')) return;

    try {
        const worldGeo = await d3.json('data/un_world_map.json?v=' + Date.now());
        new WorldMap('world-map', worldGeo);
    } catch (e) {
        console.error('Error loading UN map data:', e);
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 60px 0;">Failed to load map visualization.</p>';
    }
};
