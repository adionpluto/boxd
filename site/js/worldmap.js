class WorldMap {
    constructor(containerId, topojsonData) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        
        this.topojsonData = topojsonData;
        this.films = window.CineData && window.CineData.films ? window.CineData.films : [];
        
        // Complete mapping table from ISO 3166-1 numeric codes to ISO 3166-1 alpha-2 codes
        this.NUMERIC_TO_ALPHA2 = {
            "004": "AF", "008": "AL", "012": "DZ", "016": "AS", "020": "AD", "024": "AO", "028": "AG", "031": "AZ", "032": "AR",
            "036": "AU", "040": "AT", "044": "BS", "048": "BH", "050": "BD", "051": "AM", "052": "BB", "056": "BE", "060": "BM",
            "064": "BT", "068": "BO", "070": "BA", "072": "BW", "076": "BR", "084": "BZ", "090": "SB", "096": "BN", "100": "BG",
            "104": "MM", "108": "BI", "112": "BY", "116": "KH", "120": "CM", "124": "CA", "132": "CV", "136": "KY", "140": "CF",
            "144": "LK", "148": "TD", "152": "CL", "156": "CN", "170": "CO", "174": "KM", "178": "CG", "180": "CD", "188": "CR",
            "191": "HR", "192": "CU", "196": "CY", "203": "CZ", "204": "BJ", "208": "DK", "212": "DM", "214": "DO", "218": "EC",
            "222": "SV", "226": "GQ", "231": "ET", "232": "ER", "233": "EE", "234": "FO", "242": "FJ", "246": "FI", "250": "FR",
            "262": "DJ", "266": "GA", "268": "GE", "270": "GM", "275": "PS", "276": "DE", "288": "GH", "292": "GI", "296": "KI",
            "300": "GR", "304": "GL", "308": "GD", "312": "GP", "316": "GU", "320": "GT", "324": "GN", "328": "GY", "332": "HT",
            "340": "HN", "344": "HK", "348": "HU", "352": "IS", "356": "IN", "360": "ID", "364": "IR", "368": "IQ", "372": "IE",
            "376": "IL", "380": "IT", "384": "CI", "388": "JM", "392": "JP", "398": "KZ", "400": "JO", "404": "KE", "408": "KP",
            "410": "KR", "414": "KW", "417": "KG", "418": "LA", "422": "LB", "426": "LS", "428": "LV", "430": "LR", "434": "LY",
            "438": "LI", "440": "LT", "442": "LU", "446": "MO", "450": "MG", "454": "MW", "458": "MY", "462": "MV", "466": "ML",
            "470": "MT", "474": "MQ", "478": "MR", "480": "MU", "484": "MX", "492": "MC", "496": "MN", "498": "MD", "499": "ME",
            "504": "MA", "508": "MZ", "512": "OM", "516": "NA", "520": "NR", "524": "NP", "528": "NL", "531": "CW", "533": "AW",
            "534": "SX", "535": "BQ", "540": "NC", "548": "VU", "554": "NZ", "558": "NI", "562": "NE", "566": "NG", "570": "NU",
            "578": "NO", "586": "PK", "591": "PA", "598": "PG", "600": "PY", "604": "PE", "608": "PH", "612": "PN", "616": "PL",
            "620": "PT", "624": "GW", "626": "TL", "630": "PR", "634": "QA", "638": "RE", "642": "RO", "643": "RU", "646": "RW",
            "652": "BL", "654": "SH", "659": "KN", "660": "AI", "662": "LC", "663": "MF", "666": "PM", "670": "VC", "674": "SM",
            "678": "ST", "682": "SA", "686": "SN", "688": "RS", "690": "SC", "694": "SL", "702": "SG", "703": "SK", "704": "VN",
            "705": "SI", "706": "SO", "710": "ZA", "716": "ZW", "724": "ES", "728": "SS", "729": "SD", "732": "EH", "740": "SR",
            "744": "SJ", "748": "SZ", "752": "SE", "756": "CH", "760": "SY", "762": "TJ", "764": "TH", "768": "TG", "772": "TK",
            "776": "TO", "780": "TT", "784": "AE", "788": "TN", "792": "TR", "795": "TM", "796": "TC", "798": "TV", "800": "UG",
            "804": "UA", "807": "MK", "818": "EG", "826": "GB", "831": "GG", "832": "JE", "833": "IM", "834": "TZ", "840": "US",
            "850": "VI", "854": "BF", "858": "UY", "860": "UZ", "862": "VE", "876": "WF", "882": "WS", "887": "YE", "894": "ZM"
        };

        // Count films per country using alpha-2 codes (watched films only)
        this.countryStats = {};
        const watchedFilms = this.films.filter(f => (f.watched_dates && f.watched_dates.length > 0) || f.in_diary);
        watchedFilms.forEach(film => {
            if (film.countries && Array.isArray(film.countries)) {
                film.countries.forEach(c => {
                    if (c.code) {
                        const code = c.code.toUpperCase();
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
        if (!count || count <= 0) {
            return '#181E25'; // Unwatched dark slate base
        }

        // Non-linear logarithmic mapping so even 1-2 films are vividly visible
        const maxVal = Math.max(this.maxFilms, 10);
        const t = Math.log(count) / Math.log(maxVal); // Normalized 0.0 to 1.0

        // Balanced, rich Letterboxd green palette (capped so USA & India remain rich, saturated, and cohesive)
        return d3.interpolateRgbBasis([
            '#0F6B38', // 1 film: deep rich emerald
            '#069346', // 2-5 films: solid forest jade
            '#00B84B', // 6-25 films: vibrant grass green
            '#00D853', // 26-100 films: signature Letterboxd green
            '#00E054', // 100-300 films: bright pure green (like India)
            '#2CE76E'  // 300+ films / Top country: energetic solid green (not pale/washed-out)
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
            .style("background", "transparent");

        const g = svg.append("g");

        // Natural Earth projection
        const projection = d3.geoNaturalEarth1();
        const path = d3.geoPath().projection(projection);

        // Convert TopoJSON to GeoJSON
        const countriesGeo = topojson.feature(this.topojsonData, this.topojsonData.objects.countries);
        projection.fitSize([width, height], countriesGeo);

        // Draw countries
        g.selectAll("path")
            .data(countriesGeo.features)
            .enter().append("path")
            .attr("d", path)
            .attr("fill", d => {
                let numericId = String(d.id).padStart(3, '0');
                if (d.id === "036") numericId = "036";
                const alpha2 = this.NUMERIC_TO_ALPHA2[numericId];
                const count = alpha2 && this.countryStats[alpha2] ? this.countryStats[alpha2].count : 0;
                return this.getCountryColor(count);
            })
            .attr("stroke", d => {
                let numericId = String(d.id).padStart(3, '0');
                if (d.id === "036") numericId = "036";
                const alpha2 = this.NUMERIC_TO_ALPHA2[numericId];
                const count = alpha2 && this.countryStats[alpha2] ? this.countryStats[alpha2].count : 0;
                return count > 0 ? '#101418' : '#14181C';
            })
            .attr("stroke-width", "0.6px")
            .style("cursor", "pointer")
            .style("transition", "fill 0.15s ease, stroke 0.15s ease, filter 0.15s ease")
            .on("mouseover", (event, d) => {
                let numericId = String(d.id).padStart(3, '0');
                const alpha2 = this.NUMERIC_TO_ALPHA2[numericId];
                const stats = alpha2 ? this.countryStats[alpha2] : null;
                
                d3.select(event.currentTarget)
                    .attr("stroke", "#FFFFFF")
                    .attr("stroke-width", "1.6px")
                    .style("filter", "brightness(1.25)")
                    .raise();
                
                this.tooltip.style("visibility", "visible");
                
                const countryName = stats?.name || (d.properties && d.properties.name) || alpha2 || "Unknown Region";
                const count = stats?.count || 0;
                const topTitles = stats ? stats.films.slice(0, 3).map(f => f.title) : [];
                
                let tooltipHtml = `
                    <div style="font-weight: 700; margin-bottom: 4px; color: #00E054; font-size: 14px;">${countryName}</div>
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
                let numericId = String(d.id).padStart(3, '0');
                if (d.id === "036") numericId = "036";
                const alpha2 = this.NUMERIC_TO_ALPHA2[numericId];
                const count = alpha2 && this.countryStats[alpha2] ? this.countryStats[alpha2].count : 0;

                d3.select(event.currentTarget)
                    .attr("stroke", count > 0 ? '#101418' : '#14181C')
                    .attr("stroke-width", "0.6px")
                    .style("filter", "none");
                
                this.tooltip.style("visibility", "hidden");
            })
            .on("click", (event, d) => {
                let numericId = String(d.id).padStart(3, '0');
                const alpha2 = this.NUMERIC_TO_ALPHA2[numericId];
                if (alpha2) {
                    const filterEvent = new CustomEvent('filterByCountry', {
                        detail: { code: alpha2 }
                    });
                    document.dispatchEvent(filterEvent);
                }
            });
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
        const world = await d3.json('https://unpkg.com/world-atlas@2.0.2/countries-110m.json');
        new WorldMap('world-map', world);
    } catch (e) {
        console.error('Error loading map data:', e);
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 60px 0;">Failed to load map visualization.</p>';
    }
};
