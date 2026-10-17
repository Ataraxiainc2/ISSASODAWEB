// Dibujos de los objetos del universo (universo/objetos.json) en un lienzo 2D, con D3.
// IssaAstros.draw(ctx, objeto, x, y, radio en píxeles, tiempo en segundos)
// Cada objeto tiene su propia semilla (su nombre): se dibuja igual en cada visita.
(function (global) {
    'use strict';

    const TAU = Math.PI * 2;

    // Color de cada tipo cuando el objeto se ve como un punto
    const DOT = {
        'cosmos': '#A99BFF', 'vacio': '#3A3456', 'cumulo-galaxias': '#FFE2B0', 'galaxia': '#FFE8C0',
        'parte-galaxia': '#FFD9A0', 'corriente': '#C9D6FF', 'nube': '#FF7AD9', 'nebulosa-planetaria': '#5CF2D6',
        'remanente-sn': '#FF9A5C', 'burbuja': '#9AD0FF', 'cumulo': '#FFF1C4', 'sistema': '#FFF1C4', 'disco': '#FFB36B',
        'estrella': '#FFF1C4', 'compacta': '#BFE3FF', 'agujero': '#FF9F43', 'chorro': '#9FD8FF', 'planeta': '#4F8FE0',
        'luna': '#C8C8C8', 'anillo': '#E8D3A6', 'roca': '#A08F7A', 'cometa': '#BFE9FF', 'helado': '#D8C8B8',
        'relieve': '#D08A5A', 'atmosfera': '#7FC8FF', 'interior-estelar': '#FFB347', 'interior-planetario': '#FF7F50',
        'material': '#B8A48C', 'gas': '#9FB8FF', 'campo': '#7FDBFF', 'onda': '#FFD54F', 'flujo': '#FFE9A8',
        'actividad': '#FF8C42', 'evento': '#FFFFFF', 'pilar': '#C97B4A', 'choque': '#7FF0D0', 'filamento': '#7FB2FF',
        'materia-oscura': '#B39DFF', 'particula': '#FFFFFF', 'hadron': '#FF6B6B', 'nucleo': '#FF8A80', 'atomo': '#7FC8FF',
        'molecula': '#FF6B6B', 'agregado': '#9CCC65', 'cuasiparticula': '#80DEEA', 'cuantico': '#E1BEE7'
    };

    function seedOf(name) {
        let h = 2166136261;
        for (let i = 0; i < name.length; i++) {
            h ^= name.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0) / 4294967296;
    }

    function rgba(color, a) {
        const c = d3.color(color);
        c.opacity = a;
        return c.formatRgb();
    }

    function glow(ctx, x, y, r, color, a) {
        if (r <= 0) return;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(color, a));
        g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
    }

    function ball(ctx, x, y, r, color) {
        r = Math.max(r, 0.5);
        const c = d3.color(color);
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
        g.addColorStop(0, c.brighter(1.1).formatRgb());
        g.addColorStop(1, c.darker(1.4).formatRgb());
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
    }

    function shade(ctx, x, y, r, strength) {
        const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
        g.addColorStop(0.45, 'rgba(0, 0, 0, 0)');
        g.addColorStop(1, `rgba(0, 0, 0, ${strength || 0.6})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
    }

    function lineWidth(r, f) {
        return Math.max(0.5, r * f);
    }

    // Puntos dentro de un disco unidad
    function diskPoints(rnd, n, spread) {
        return d3.range(n).map(() => {
            const a = rnd() * TAU, d = Math.sqrt(rnd()) * (spread || 1);
            return [d * Math.cos(a), d * Math.sin(a)];
        });
    }

    function gaussPoints(rnd, n, sd) {
        const g = d3.randomNormal.source(rnd)(0, sd);
        return d3.range(n).map(() => [g(), g()]);
    }

    // Una forma irregular cerrada (asteroides, granos, cuerpos helados)
    function blobPath(rnd, n, min) {
        const radii = d3.range(n).map(() => min + (1 - min) * rnd());
        return d3.lineRadial()
            .angle((d, i) => i / n * TAU)
            .radius(d => d)
            .curve(d3.curveCardinalClosed)(radii);
    }

    // Dibuja un Path2D definido en coordenadas unidad, escalado a (x, y, r)
    function fillUnit(ctx, path, x, y, r, rot) {
        ctx.save();
        ctx.translate(x, y);
        if (rot) ctx.rotate(rot);
        ctx.scale(r, r);
        ctx.fill(path);
        ctx.restore();
    }

    // Galaxia espiral de partículas (unidad); la usan galaxias, partes y halos
    function spiralModel(rnd, irregular) {
        const g = d3.randomNormal.source(rnd)(0, 1);
        return d3.range(irregular ? 260 : 520).map(() => {
            if (irregular) {
                const c = Math.floor(rnd() * 5);
                return [Math.cos(c * 1.3) * 0.4 + g() * 0.25, Math.sin(c * 2.1) * 0.3 + g() * 0.22, rnd()];
            }
            if (rnd() < 0.25) return [g() * 0.12, g() * 0.12, rnd()];
            const t = rnd() ** 0.7;
            const a = Math.floor(rnd() * 2) * Math.PI + t * 4.2 + g() * 0.22;
            return [t * Math.cos(a), t * Math.sin(a), rnd()];
        });
    }

    function drawSpiral(ctx, pts, x, y, r, color, rot, squash, alphaScale) {
        const cr = Math.cos(rot), sr = Math.sin(rot);
        const size = Math.max(0.8, r * 0.011);
        glow(ctx, x, y, r * 0.18, '#FFE7B8', 0.55 * alphaScale);
        const c = d3.color(color);
        for (const p of pts) {
            const px = p[0] * cr - p[1] * sr, py = (p[0] * sr + p[1] * cr) * squash;
            c.opacity = (0.35 + 0.65 * p[2]) * alphaScale;
            ctx.fillStyle = c.formatRgb();
            ctx.fillRect(x + px * r - size / 2, y + py * r - size / 2, size, size);
        }
    }

    // Red de nodos unidos por Delaunay: estructura cósmica y materia oscura
    function webModel(rnd, kind) {
        let pts;
        if (kind === 'filamento') pts = d3.range(70).map(() => [rnd() * 2 - 1, (rnd() * 2 - 1) * 0.25 + Math.sin(rnd() * 3) * 0.1]);
        else if (kind === 'muralla') pts = d3.range(80).map(() => [rnd() * 2 - 1, (rnd() * 2 - 1) * 0.35]);
        else pts = diskPoints(rnd, 80);
        const delaunay = d3.Delaunay.from(pts);
        const edges = [];
        const { halfedges, triangles } = delaunay;
        for (let i = 0; i < halfedges.length; i++) {
            const j = halfedges[i];
            if (j < i) continue;
            const a = pts[triangles[i]], b = pts[triangles[i % 3 === 2 ? i - 2 : i + 1]];
            if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.38) edges.push([a, b]);
        }
        return { pts: pts, edges: edges };
    }

    function drawWeb(ctx, web, x, y, r, color, dashed, a) {
        ctx.strokeStyle = rgba(color, 0.4 * a);
        ctx.lineWidth = lineWidth(r, 0.006);
        if (dashed) ctx.setLineDash([lineWidth(r, 0.02), lineWidth(r, 0.02)]);
        ctx.beginPath();
        web.edges.forEach(([p, q]) => {
            ctx.moveTo(x + p[0] * r, y + p[1] * r);
            ctx.lineTo(x + q[0] * r, y + q[1] * r);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        web.pts.forEach(p => glow(ctx, x + p[0] * r, y + p[1] * r, Math.max(1.5, r * 0.035), '#E6D8FF', 0.7 * a));
    }

    // Moléculas: átomos y enlaces, colocados con d3.forceSimulation
    const ELEMENT = {
        H: ['#FFFFFF', 0.22], C: ['#7D8590', 0.34], O: ['#FF4D4D', 0.32], N: ['#4D7CFF', 0.33], S: ['#FFD84D', 0.4]
    };
    const FORMULAS = {
        H2O: ['OHH', [[0, 1], [0, 2]], [[1, 2, 1.58]]],
        H2: ['HH', [[0, 1]]],
        O2: ['OO', [[0, 1]]],
        CO: ['CO', [[0, 1]]],
        HCN: ['HCN', [[0, 1], [1, 2]]],
        HCO: ['HCO', [[0, 1], [1, 2]]],
        H2CO: ['COHH', [[0, 1], [0, 2], [0, 3]]],
        C2H5OH: ['CCOHHHHHH', [[0, 1], [1, 2], [2, 3], [0, 4], [0, 5], [0, 6], [1, 7], [1, 8]]],
        H2SO4: ['SOOOOHH', [[0, 1], [0, 2], [0, 3], [0, 4], [3, 5], [4, 6]]],
        C6: ['CCCCCC', [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]]],
        CO2: ['COO', [[0, 1], [0, 2]]],
        CH4: ['CHHHH', [[0, 1], [0, 2], [0, 3], [0, 4]]],
        NH3: ['NHHH', [[0, 1], [0, 2], [0, 3]]],
        O3: ['OOO', [[0, 1], [1, 2]], [[0, 2, 1.71]]],
        HC5N: ['HCCCCCN', [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]]
    };

    function moleculeModel(formula, rnd) {
        const def = FORMULAS[formula] || FORMULAS.H2O;
        const nodes = def[0].split('').map((e, i) => ({ e: e, x: Math.cos(i * 2.4) + rnd() * 0.01, y: Math.sin(i * 2.4) }));
        const links = def[1].map(([s, t]) => ({ source: s, target: t, d: 1 }));
        // Enlaces invisibles que fijan ángulos reales (agua 104,5°, ozono 117°)
        const angles = (def[2] || []).map(([s, t, d]) => ({ source: s, target: t, d: d }));
        d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links.concat(angles)).distance(l => l.d).strength(1))
            .force('charge', d3.forceManyBody().strength(-1.2))
            .force('center', d3.forceCenter(0, 0))
            .stop()
            .tick(300);
        const ext = d3.max(nodes, n => Math.hypot(n.x, n.y) + ELEMENT[n.e][1]) || 1;
        nodes.forEach(n => { n.x /= ext; n.y /= ext; n.r = ELEMENT[n.e][1] / ext; });
        return { nodes: nodes, links: links };
    }

    // Esferas empaquetadas (núcleos, cúmulos atómicos) con d3.packSiblings
    function packModel(n, rnd) {
        const circles = d3.range(n).map(() => ({ r: 1, kind: rnd() }));
        d3.packSiblings(circles);
        const ext = d3.max(circles, c => Math.hypot(c.x, c.y) + c.r);
        circles.forEach(c => { c.x /= ext; c.y /= ext; c.r /= ext; });
        return circles.sort((a, b) => a.y - b.y);
    }

    // Planetas: d3-geo con proyección ortográfica
    const projection = d3.geoOrthographic().clipAngle(90).precision(0.8);
    const geoPath = d3.geoPath(projection);

    function planetModel(o, rnd) {
        const kind = o.k || 'terrestre';
        const base = d3.color(o.c || DOT.planeta);
        const m = { base: base.formatHex(), layers: [] };
        if (kind === 'gaseoso' || kind === 'helado') {
            let lat = -90;
            let i = 0;
            while (lat < 90) {
                const next = Math.min(90, lat + 8 + rnd() * 14);
                const ring = [];
                // Sentido horario (norte hacia el este, sur de vuelta): d3-geo lo toma como la banda y no como su complemento
                for (let lon = -180; lon <= 180; lon += 10) ring.push([lon, next]);
                for (let lon = 180; lon >= -180; lon -= 10) ring.push([lon, lat]);
                const color = (i % 2 ? base.brighter(kind === 'helado' ? 0.25 : 0.7) : base.darker(kind === 'helado' ? 0.15 : 0.4)).formatHex();
                m.layers.push({ geo: { type: 'Polygon', coordinates: [ring] }, color: color });
                lat = next;
                i++;
            }
        } else {
            const spots = kind === 'enano' ? 14 : kind === 'proto' ? 10 : 9;
            const land = kind === 'terrestre' && base.b > base.r ? '#5E8C4A' : base.darker(0.8).formatHex();
            const color = kind === 'proto' ? '#FFB347' : kind === 'enano' ? base.darker(0.7).formatHex() : land;
            m.layers.push({
                geo: { type: 'GeometryCollection', geometries: d3.range(spots).map(() => d3.geoCircle().center([rnd() * 360 - 180, rnd() * 140 - 70]).radius(kind === 'enano' ? 3 + rnd() * 9 : 6 + rnd() * 22)()) },
                color: color
            });
        }
        return m;
    }

    function drawPlanet(ctx, o, m, x, y, r, t) {
        if (!m.planet) m.planet = planetModel(o, m.rnd);
        const p = m.planet;
        glow(ctx, x, y, r * 1.35, p.base, o.k === 'errante' ? 0.15 : 0.35);
        projection.scale(r).translate([x, y]).rotate([t * 6 + m.seed * 360, -15]);
        geoPath.context(ctx);
        ctx.beginPath();
        geoPath({ type: 'Sphere' });
        ctx.fillStyle = p.base;
        ctx.fill();
        p.layers.forEach(layer => {
            ctx.beginPath();
            geoPath(layer.geo);
            ctx.fillStyle = layer.color;
            ctx.fill();
        });
        shade(ctx, x, y, r, o.k === 'errante' ? 0.85 : 0.6);
    }

    function cutaway(ctx, x, y, r, rings, highlight) {
        // Esfera con un cuarto recortado para ver sus capas
        rings.forEach((ring, i) => {
            ctx.globalAlpha = highlight < 0 || highlight === i ? 1 : 0.35;
            ctx.fillStyle = ring[1];
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x, y, r * ring[0], -Math.PI / 2, 0);
            ctx.closePath();
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = rings[rings.length - 1][1];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, r * rings[rings.length - 1][0], 0, Math.PI * 1.5);
        ctx.closePath();
        ctx.fill();
        shade(ctx, x, y, r, 0.45);
        if (highlight >= 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = lineWidth(r, 0.012);
            ctx.beginPath();
            ctx.arc(x, y, r * rings[highlight][0], -Math.PI / 2, 0);
            ctx.stroke();
        }
    }

    function postcard(ctx, x, y, r, draw) {
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - r, y - r * 0.75, r * 2, r * 1.5, r * 0.12);
        else ctx.rect(x - r, y - r * 0.75, r * 2, r * 1.5);
        ctx.clip();
        const sky = ctx.createLinearGradient(0, y - r * 0.75, 0, y + r * 0.75);
        sky.addColorStop(0, '#0B0D14');
        sky.addColorStop(1, '#3A2A2A');
        ctx.fillStyle = sky;
        ctx.fillRect(x - r, y - r * 0.75, r * 2, r * 1.5);
        draw();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - r, y - r * 0.75, r * 2, r * 1.5, r * 0.12);
        else ctx.rect(x - r, y - r * 0.75, r * 2, r * 1.5);
        ctx.stroke();
    }

    function polygon(ctx, pts, x, y, r, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + p[0] * r, y + p[1] * r));
        ctx.closePath();
        ctx.fill();
    }

    function wave(ctx, x0, x1, y, amp, cycles, phase, color, width) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        const n = 80;
        for (let i = 0; i <= n; i++) {
            const u = i / n;
            const px = x0 + (x1 - x0) * u;
            const py = y + amp * Math.sin(u * cycles * TAU + phase);
            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.stroke();
    }

    const PARTICLE_COLOR = {
        quark: null, antiquark: null, lepton: '#4FC3FF', antilepton: '#FF5FD1', boson: '#FFD54F', higgs: '#FFB300',
        foton: '#FFF59D', virtual: '#B0BEC5', oscura: '#7E57C2', anti: '#FF5FD1', generica: '#FFFFFF'
    };
    const QUARK_COLORS = ['#FF5252', '#69F0AE', '#448AFF'];
    const ANTIQUARK_COLORS = ['#18FFFF', '#FF4081', '#FFFF00'];

    const DRAW = {
        'cosmos': (ctx, o, m, x, y, r) => {
            if (!m.web) m.web = webModel(m.rnd, o.k);
            glow(ctx, x, y, r, '#5B3FA8', 0.25);
            ctx.globalCompositeOperation = 'lighter';
            drawWeb(ctx, m.web, x, y, r, '#8E7CFF', false, 1);
        },
        'vacio': (ctx, o, m, x, y, r) => {
            if (!m.web) m.web = webModel(m.rnd);
            ctx.globalCompositeOperation = 'lighter';
            drawWeb(ctx, m.web, x, y, r * 1.35, '#8E7CFF', false, 0.8);
            ctx.globalCompositeOperation = 'source-over';
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, 'rgba(3, 3, 8, 0.95)');
            g.addColorStop(0.8, 'rgba(3, 3, 8, 0.85)');
            g.addColorStop(1, 'rgba(3, 3, 8, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.fill();
        },
        'cumulo-galaxias': (ctx, o, m, x, y, r) => {
            if (!m.gals) {
                const n = { grupo: 14, cumulo: 70, supercumulo: 120, complejo: 140 }[o.k] || 60;
                const clumps = o.k === 'supercumulo' || o.k === 'complejo' ? 6 : 1;
                const g = d3.randomNormal.source(m.rnd)(0, clumps > 1 ? 0.12 : 0.35);
                const centers = d3.range(clumps).map(() => clumps > 1 ? [(m.rnd() * 2 - 1) * 0.6, (m.rnd() * 2 - 1) * 0.6] : [0, 0]);
                m.gals = d3.range(n).map(() => {
                    const c = centers[Math.floor(m.rnd() * clumps)];
                    return { x: c[0] + g(), y: c[1] + g(), s: 0.01 + m.rnd() ** 3 * 0.05, a: m.rnd() * Math.PI, e: 0.3 + m.rnd() * 0.7, c: d3.interpolateRgb('#FFE2B0', '#AFC8FF')(m.rnd()) };
                });
            }
            ctx.globalCompositeOperation = 'lighter';
            glow(ctx, x, y, r, '#6A4FA0', 0.15);
            m.gals.forEach(gx => {
                const px = x + gx.x * r, py = y + gx.y * r, s = Math.max(0.8, gx.s * r);
                glow(ctx, px, py, s * 2.5, gx.c, 0.45);
                ctx.fillStyle = rgba(gx.c, 0.9);
                ctx.beginPath();
                ctx.ellipse(px, py, s, s * gx.e, gx.a, 0, TAU);
                ctx.fill();
            });
        },
        'galaxia': (ctx, o, m, x, y, r, t) => {
            if (!m.pts) m.pts = spiralModel(m.rnd, o.k === 'irregular');
            ctx.globalCompositeOperation = 'lighter';
            drawSpiral(ctx, m.pts, x, y, r, o.c || DOT.galaxia, t * 0.04 + m.seed * TAU, 0.55, 1);
        },
        'parte-galaxia': (ctx, o, m, x, y, r, t) => {
            if (!m.pts) m.pts = spiralModel(m.rnd, false);
            const scale = { halo: 0.35, disco: 1, bulbo: 4, barra: 1.6, brazo: 1.3, region: 6, corona: 0.22 }[o.k] || 1;
            const rot = t * 0.04 + m.seed * TAU;
            ctx.globalCompositeOperation = 'lighter';
            drawSpiral(ctx, m.pts, x, y, r * scale, '#FFE8C0', rot, 0.55, 0.45);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = lineWidth(r, 0.01);
            if (o.k === 'halo' || o.k === 'corona') {
                glow(ctx, x, y, r, o.k === 'corona' ? '#7FB2FF' : '#C9B8FF', 0.35);
            } else if (o.k === 'disco') {
                ctx.beginPath();
                ctx.ellipse(x, y, r, r * 0.55, 0, 0, TAU);
                ctx.stroke();
            } else if (o.k === 'bulbo') {
                glow(ctx, x, y, r * 1.2, '#FFE7B8', 0.9);
            } else if (o.k === 'barra') {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(rot);
                ctx.scale(1, 0.55);
                const g = ctx.createLinearGradient(-r, 0, r, 0);
                g.addColorStop(0, 'rgba(255, 220, 160, 0)');
                g.addColorStop(0.5, 'rgba(255, 220, 160, 0.8)');
                g.addColorStop(1, 'rgba(255, 220, 160, 0)');
                ctx.fillStyle = g;
                ctx.fillRect(-r, -r * 0.18, r * 2, r * 0.36);
                ctx.restore();
            } else {
                ctx.setLineDash([lineWidth(r, 0.04), lineWidth(r, 0.03)]);
                ctx.beginPath();
                if (o.k === 'brazo') {
                    for (let i = 0; i <= 40; i++) {
                        const tt = 0.25 + i / 40 * 0.75, a = tt * 4.2 + rot;
                        const px = x + tt * r * scale * Math.cos(a), py = y + tt * r * scale * Math.sin(a) * 0.55;
                        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
                    }
                } else {
                    ctx.arc(x, y, r, 0, TAU);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }
        },
        'corriente': (ctx, o, m, x, y, r, t) => {
            if (!m.pts) {
                const g = d3.randomNormal.source(m.rnd)(0, 0.04);
                m.pts = d3.range(400).map(() => {
                    const u = m.rnd();
                    if (o.k === 'marea') {
                        const side = m.rnd() < 0.5 ? -1 : 1;
                        return [side * (0.15 + u * 0.85) + g(), side * Math.sin(u * 2.5) * 0.4 + g()];
                    }
                    const a = u * Math.PI * 1.6;
                    return [Math.cos(a) * 0.85 + g(), Math.sin(a) * 0.5 + g()];
                });
                m.gal = spiralModel(m.rnd, false);
            }
            ctx.globalCompositeOperation = 'lighter';
            drawSpiral(ctx, m.gal, x, y, r * 0.18, '#FFE8C0', t * 0.05, 0.55, 0.8);
            ctx.fillStyle = 'rgba(201, 214, 255, 0.6)';
            const s = Math.max(0.7, r * 0.006);
            m.pts.forEach(p => ctx.fillRect(x + p[0] * r, y + p[1] * r, s, s));
        },
        'nube': (ctx, o, m, x, y, r, t) => {
            if (!m.blobs) {
                m.blobs = d3.range(9).map(() => [(m.rnd() * 2 - 1) * 0.5, (m.rnd() * 2 - 1) * 0.4, 0.35 + m.rnd() * 0.45]);
                m.stars = diskPoints(m.rnd, 16, 0.8).map(p => [p[0], p[1], m.rnd() * TAU]);
            }
            const color = o.c || DOT.nube;
            const dark = o.k === 'oscura';
            if (o.k === 'nudo') {
                glow(ctx, x - r * 0.5, y, r * 0.5, color, 0.8);
                const g = ctx.createLinearGradient(x - r * 0.5, y, x + r, y);
                g.addColorStop(0, rgba(color, 0.6));
                g.addColorStop(1, rgba(color, 0));
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(x - r * 0.5, y - r * 0.3);
                ctx.quadraticCurveTo(x + r * 0.4, y, x + r, y);
                ctx.quadraticCurveTo(x + r * 0.4, y, x - r * 0.5, y + r * 0.3);
                ctx.fill();
                return;
            }
            if (dark) glow(ctx, x, y, r * 1.2, '#FF9A6B', 0.25);
            ctx.globalCompositeOperation = dark ? 'source-over' : 'lighter';
            m.blobs.forEach(b => {
                const g = ctx.createRadialGradient(x + b[0] * r, y + b[1] * r, 0, x + b[0] * r, y + b[1] * r, b[2] * r);
                g.addColorStop(0, rgba(color, dark ? 0.85 : 0.32));
                g.addColorStop(1, rgba(color, 0));
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(x + b[0] * r, y + b[1] * r, b[2] * r, 0, TAU);
                ctx.fill();
            });
            if (!dark) {
                ctx.fillStyle = '#FFFFFF';
                m.stars.forEach(s => {
                    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s[2]);
                    const size = Math.max(1, r * 0.008);
                    ctx.fillRect(x + s[0] * r, y + s[1] * r, size, size);
                });
                ctx.globalAlpha = 1;
            }
        },
        'nebulosa-planetaria': (ctx, o, m, x, y, r, t) => {
            const color = o.c || DOT['nebulosa-planetaria'];
            ctx.globalCompositeOperation = 'lighter';
            glow(ctx, x, y, r * 1.2, color, 0.2);
            const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r);
            g.addColorStop(0, rgba(color, 0));
            g.addColorStop(0.65, rgba(color, 0.65));
            g.addColorStop(0.8, rgba('#FF6B9A', 0.45));
            g.addColorStop(1, rgba(color, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.85, 0.4, 0, TAU);
            ctx.fill();
            glow(ctx, x, y, r * 0.12, '#FFFFFF', 0.95);
            if (o.k === 'pwn') {
                ctx.strokeStyle = 'rgba(200, 230, 255, 0.7)';
                ctx.lineWidth = lineWidth(r, 0.01);
                const a = t * 3;
                ctx.beginPath();
                ctx.moveTo(x - Math.cos(a) * r * 0.8, y - Math.sin(a) * r * 0.8);
                ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
                ctx.stroke();
            }
        },
        'remanente-sn': (ctx, o, m, x, y, r) => {
            if (!m.arcs) m.arcs = d3.range(140).map(() => [m.rnd() * TAU, 0.1 + m.rnd() * 0.3, 0.75 + m.rnd() * 0.25, m.rnd()]);
            const color = o.c || DOT['remanente-sn'];
            ctx.globalCompositeOperation = 'lighter';
            glow(ctx, x, y, r * 0.8, '#5B8CFF', 0.25);
            ctx.lineWidth = lineWidth(r, 0.008);
            m.arcs.forEach(a => {
                ctx.strokeStyle = rgba(a[3] < 0.5 ? color : '#FF5A7A', 0.55);
                ctx.beginPath();
                ctx.arc(x, y, r * a[2], a[0], a[0] + a[1]);
                ctx.stroke();
            });
        },
        'burbuja': (ctx, o, m, x, y, r) => {
            const color = o.c || DOT.burbuja;
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r);
            g.addColorStop(0, rgba(color, 0.06));
            g.addColorStop(0.92, rgba(color, 0.55));
            g.addColorStop(1, rgba(color, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.fill();
            glow(ctx, x - r * 0.15, y + r * 0.1, r * 0.1, '#FFFFFF', 0.9);
        },
        'cumulo': (ctx, o, m, x, y, r, t) => {
            if (!m.stars) {
                const n = { globular: 450, abierto: 50, asociacion: 32 }[o.k] || 100;
                const pts = o.k === 'globular' ? gaussPoints(m.rnd, n, 0.3) : diskPoints(m.rnd, n, 0.9);
                m.stars = pts.map(p => [p[0], p[1], m.rnd(), m.rnd() * TAU]);
            }
            ctx.globalCompositeOperation = 'lighter';
            if (o.k === 'globular') glow(ctx, x, y, r * 0.6, '#FFE2A8', 0.5);
            m.stars.forEach(s => {
                const color = o.k === 'globular' ? d3.interpolateRgb('#FFD27A', '#FFF6E0')(s[2]) : d3.interpolateRgb('#BFD4FF', '#FFFFFF')(s[2]);
                const size = Math.max(0.8, r * (o.k === 'globular' ? 0.008 : 0.02) * (0.5 + s[2]));
                glow(ctx, x + s[0] * r, y + s[1] * r, size * 2.5, color, 0.5 + 0.3 * Math.sin(t * 1.5 + s[3]));
            });
        },
        'sistema': (ctx, o, m, x, y, r, t) => {
            const star = o.c || '#FFF1C4';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.lineWidth = 1;
            if (o.k === 'binario' || o.k === 'binario-bh' || o.k === 'multiple') {
                const a = t * 0.6 + m.seed * TAU;
                ctx.beginPath();
                ctx.ellipse(x, y, r * 0.45, r * 0.45 * 0.4, 0, 0, TAU);
                ctx.stroke();
                const pts = [[Math.cos(a), Math.sin(a)], [-Math.cos(a), -Math.sin(a)]];
                pts.forEach(p => {
                    const px = x + p[0] * r * 0.45, py = y + p[1] * r * 0.45 * 0.4;
                    if (o.k === 'binario-bh') {
                        glow(ctx, px, py, r * 0.22, '#FF9F43', 0.6);
                        ctx.fillStyle = '#000000';
                        ctx.beginPath();
                        ctx.arc(px, py, r * 0.08, 0, TAU);
                        ctx.fill();
                    } else {
                        glow(ctx, px, py, r * 0.3, star, 0.4);
                        ball(ctx, px, py, r * 0.08, star);
                    }
                });
                if (o.k === 'multiple') {
                    const b = t * 0.2;
                    ctx.beginPath();
                    ctx.ellipse(x, y, r * 0.9, r * 0.9 * 0.4, 0, 0, TAU);
                    ctx.stroke();
                    ball(ctx, x + Math.cos(b) * r * 0.9, y + Math.sin(b) * r * 0.36, r * 0.06, '#FFB36B');
                }
                return;
            }
            if (o.k === 'acrecion') {
                ball(ctx, x + r * 0.5, y, r * 0.35, '#FF7A5C');
                ctx.strokeStyle = 'rgba(255, 170, 120, 0.7)';
                ctx.lineWidth = lineWidth(r, 0.03);
                ctx.beginPath();
                ctx.moveTo(x + r * 0.2, y);
                ctx.quadraticCurveTo(x - r * 0.1, y - r * 0.15, x - r * 0.45, y - r * 0.05);
                ctx.stroke();
                ctx.fillStyle = 'rgba(255, 220, 180, 0.6)';
                ctx.beginPath();
                ctx.ellipse(x - r * 0.5, y, r * 0.25, r * 0.08, 0, 0, TAU);
                ctx.fill();
                glow(ctx, x - r * 0.5, y, r * 0.06, '#E8F0FF', 1);
                return;
            }
            glow(ctx, x, y, r * 0.25, star, 0.55);
            ball(ctx, x, y, r * 0.05, star);
            [0.22, 0.38, 0.58, 0.85].forEach((orbit, i) => {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.beginPath();
                ctx.ellipse(x, y, r * orbit, r * orbit * 0.4, 0, 0, TAU);
                ctx.stroke();
                const a = t * (0.6 / (i + 1)) + i * 1.7 + m.seed * TAU;
                ball(ctx, x + Math.cos(a) * r * orbit, y + Math.sin(a) * r * orbit * 0.4, Math.max(1.2, r * (0.012 + i * 0.006)), ['#7FDBFF', '#FF8FA3', '#D9A36B', '#5B8CFF'][i]);
            });
        },
        'disco': (ctx, o, m, x, y, r, t) => {
            const tilt = 0.35;
            const ring = (inner, outer, stops) => {
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(1, tilt);
                const g = ctx.createRadialGradient(0, 0, r * inner, 0, 0, r * outer);
                stops.forEach(s => g.addColorStop(s[0], s[1]));
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(0, 0, r * outer, 0, TAU);
                ctx.arc(0, 0, r * inner, 0, TAU, true);
                ctx.fill();
                ctx.restore();
            };
            if (o.k === 'toro') {
                ring(0.35, 1, [[0, 'rgba(90, 60, 40, 0)'], [0.3, 'rgba(110, 75, 50, 0.9)'], [0.7, 'rgba(80, 55, 40, 0.8)'], [1, 'rgba(60, 40, 30, 0)']]);
                glow(ctx, x, y, r * 0.2, '#FFE7B8', 0.9);
                return;
            }
            if (o.k === 'acrecion') {
                ring(0.12, 1, [[0, 'rgba(255, 255, 255, 0.95)'], [0.3, 'rgba(255, 200, 120, 0.85)'], [0.7, 'rgba(255, 110, 60, 0.6)'], [1, 'rgba(255, 80, 40, 0)']]);
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(x, y, r * 0.1, 0, TAU);
                ctx.fill();
                return;
            }
            if (o.k === 'escombros') {
                ring(0.6, 0.85, [[0, 'rgba(230, 200, 160, 0)'], [0.5, 'rgba(230, 200, 160, 0.6)'], [1, 'rgba(230, 200, 160, 0)']]);
            } else {
                ring(0.08, 1, [[0, 'rgba(255, 210, 150, 0.9)'], [0.5, 'rgba(230, 140, 80, 0.55)'], [1, 'rgba(160, 80, 60, 0)']]);
                ctx.strokeStyle = 'rgba(20, 10, 10, 0.55)';
                ctx.lineWidth = lineWidth(r, 0.015);
                [0.35, 0.55, 0.75].forEach(g => {
                    ctx.beginPath();
                    ctx.ellipse(x, y, r * g, r * g * tilt, 0, 0, TAU);
                    ctx.stroke();
                });
            }
            if (o.k === 'binario') {
                const a = t;
                ball(ctx, x + Math.cos(a) * r * 0.06, y, r * 0.03, '#FFF1C4');
                ball(ctx, x - Math.cos(a) * r * 0.06, y, r * 0.025, '#FFB36B');
            } else if (o.k === 'planetario') {
                ball(ctx, x, y, r * 0.06, '#D9A36B');
            } else {
                glow(ctx, x, y, r * 0.12, '#FFF1C4', 1);
            }
        },
        'estrella': (ctx, o, m, x, y, r, t) => {
            const color = o.c || DOT.estrella;
            let rr = r;
            if (o.k === 'variable') rr = r * (1 + 0.08 * Math.sin(t * 2 + m.seed * TAU));
            if (o.k === 'proto') {
                glow(ctx, x, y, r * 3, '#C0603F', 0.35);
                ctx.strokeStyle = 'rgba(255, 200, 160, 0.35)';
                ctx.lineWidth = lineWidth(r, 0.08);
                ctx.beginPath();
                ctx.moveTo(x, y - r * 3);
                ctx.lineTo(x, y + r * 3);
                ctx.stroke();
            }
            if (o.k === 'wolf') {
                ctx.strokeStyle = 'rgba(168, 200, 255, 0.35)';
                ctx.lineWidth = lineWidth(r, 0.04);
                [1.6, 2.2, 2.8].forEach(f => {
                    const k = (f + t * 0.3) % 2 + 1.2;
                    ctx.beginPath();
                    ctx.arc(x, y, r * k, 0, TAU);
                    ctx.stroke();
                });
            }
            if (o.k !== 'marron') glow(ctx, x, y, rr * 2.4, color, 0.45);
            ball(ctx, x, y, rr, color);
            if (o.k === 'marron') {
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, rr, 0, TAU);
                ctx.clip();
                ctx.fillStyle = 'rgba(40, 15, 10, 0.35)';
                for (let i = -3; i <= 3; i += 2) ctx.fillRect(x - rr, y + i * rr * 0.2, rr * 2, rr * 0.18);
                ctx.restore();
                shade(ctx, x, y, rr, 0.5);
            }
            if (o.k === 'fulgurante' && Math.sin(t * 0.9 + m.seed * 10) > 0.6) {
                glow(ctx, x + rr * 0.7, y - rr * 0.7, rr * 0.9, '#FFFFFF', 0.9);
            }
        },
        'compacta': (ctx, o, m, x, y, r, t) => {
            const color = o.c || DOT.compacta;
            if (o.k === 'pulsar') {
                const a = t * 4;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(a);
                const g = ctx.createLinearGradient(0, -r * 8, 0, r * 8);
                g.addColorStop(0, 'rgba(160, 216, 255, 0)');
                g.addColorStop(0.5, 'rgba(160, 216, 255, 0.6)');
                g.addColorStop(1, 'rgba(160, 216, 255, 0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(-r * 1.2, -r * 8);
                ctx.lineTo(r * 1.2, -r * 8);
                ctx.lineTo(0, 0);
                ctx.lineTo(r * 1.2, r * 8);
                ctx.lineTo(-r * 1.2, r * 8);
                ctx.lineTo(0, 0);
                ctx.fill();
                ctx.restore();
            }
            if (o.k === 'magnetar') {
                ctx.strokeStyle = 'rgba(214, 168, 255, 0.55)';
                ctx.lineWidth = lineWidth(r, 0.06);
                [1.8, 2.8, 4].forEach(L => {
                    ctx.beginPath();
                    for (let i = 0; i <= 40; i++) {
                        const th = i / 40 * Math.PI;
                        const d = L * Math.sin(th) ** 2;
                        const px = x + d * Math.sin(th) * r, py = y + d * Math.cos(th) * r;
                        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
                    }
                    ctx.moveTo(x, y - L * 0);
                    for (let i = 0; i <= 40; i++) {
                        const th = i / 40 * Math.PI;
                        const d = L * Math.sin(th) ** 2;
                        const px = x - d * Math.sin(th) * r, py = y + d * Math.cos(th) * r;
                        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
                    }
                    ctx.stroke();
                });
            }
            glow(ctx, x, y, r * 5, color, 0.5);
            ball(ctx, x, y, r, '#FFFFFF');
        },
        'agujero': (ctx, o, m, x, y, r, t) => {
            const jets = o.k === 'agn' || o.k === 'cuasar' || o.k === 'blazar';
            // Sombra, anillo de fotones y disco caben en el tamaño del objeto
            const hole = jets ? r * 0.12 : r * 0.42;
            if (o.k === 'cuasar') glow(ctx, x, y, r * 1.6, '#FFFFFF', 0.6);
            if (o.k === 'blazar') {
                glow(ctx, x, y, r * 1.2, '#9FD8FF', 0.8);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.lineWidth = lineWidth(r, 0.01);
                ctx.beginPath();
                ctx.moveTo(x - r, y);
                ctx.lineTo(x + r, y);
                ctx.moveTo(x, y - r);
                ctx.lineTo(x, y + r);
                ctx.stroke();
                return;
            }
            if (jets) {
                const g = ctx.createLinearGradient(x, y - r, x, y + r);
                g.addColorStop(0, 'rgba(160, 216, 255, 0)');
                g.addColorStop(0.5, 'rgba(160, 216, 255, 0.7)');
                g.addColorStop(1, 'rgba(160, 216, 255, 0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x - r * 0.08, y - r);
                ctx.lineTo(x + r * 0.08, y - r);
                ctx.closePath();
                ctx.moveTo(x, y);
                ctx.lineTo(x - r * 0.08, y + r);
                ctx.lineTo(x + r * 0.08, y + r);
                ctx.closePath();
                ctx.fill();
            }
            if (o.k === 'horizonte') {
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(x, y, r, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.setLineDash([lineWidth(r, 0.06), lineWidth(r, 0.05)]);
                ctx.lineWidth = lineWidth(r, 0.015);
                ctx.stroke();
                ctx.setLineDash([]);
                return;
            }
            // Disco de acreción detrás, sombra, anillo de fotones y la parte delantera del disco
            const disk = (from, to) => {
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(1, 0.25);
                const g = ctx.createRadialGradient(0, 0, hole * 1.5, 0, 0, hole * 4);
                g.addColorStop(0, 'rgba(255, 240, 210, 0.95)');
                g.addColorStop(0.4, 'rgba(255, 170, 80, 0.8)');
                g.addColorStop(1, 'rgba(255, 90, 40, 0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(0, 0, hole * 4, from, to);
                ctx.arc(0, 0, hole * 1.5, to, from, true);
                ctx.fill();
                ctx.restore();
            };
            disk(Math.PI, TAU);
            glow(ctx, x, y - hole * 0.2, hole * 1.9, '#FFB060', 0.35);
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(x, y, hole, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 220, 170, 0.85)';
            ctx.lineWidth = lineWidth(hole, 0.06);
            ctx.beginPath();
            ctx.arc(x, y, hole * 1.12, 0, TAU);
            ctx.stroke();
            disk(0, Math.PI);
        },
        'chorro': (ctx, o, m, x, y, r, t) => {
            const g = ctx.createLinearGradient(x - r, y, x + r, y);
            g.addColorStop(0, 'rgba(160, 216, 255, 0)');
            g.addColorStop(0.5, 'rgba(160, 216, 255, 0.75)');
            g.addColorStop(1, 'rgba(160, 216, 255, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + r, y - r * 0.08);
            ctx.lineTo(x + r, y + r * 0.08);
            ctx.closePath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - r, y - r * 0.08);
            ctx.lineTo(x - r, y + r * 0.08);
            ctx.closePath();
            ctx.fill();
            for (let i = 1; i <= 4; i++) {
                const d = ((i / 5 + t * 0.1) % 1) * r;
                glow(ctx, x + d, y, r * 0.04, '#FFFFFF', 0.8);
                glow(ctx, x - d, y, r * 0.04, '#FFFFFF', 0.8);
            }
            glow(ctx, x, y, r * 0.08, '#FFF1C4', 1);
            if (o.k === 'hh') {
                ctx.strokeStyle = 'rgba(255, 120, 150, 0.8)';
                ctx.lineWidth = lineWidth(r, 0.02);
                [-1, 1].forEach(side => {
                    ctx.beginPath();
                    ctx.arc(x + side * r * 0.85, y, r * 0.15, side > 0 ? -1.2 : Math.PI - 1.2, side > 0 ? 1.2 : Math.PI + 1.2);
                    ctx.stroke();
                });
            }
        },
        'planeta': drawPlanet,
        'luna': (ctx, o, m, x, y, r) => {
            if (!m.craters) m.craters = diskPoints(m.rnd, 14, 0.85).map(p => [p[0], p[1], 0.05 + m.rnd() * 0.15]);
            ball(ctx, x, y, r, o.c || '#BDBDBD');
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.clip();
            m.craters.forEach(c => {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
                ctx.beginPath();
                ctx.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.lineWidth = lineWidth(r, 0.008);
                ctx.stroke();
            });
            ctx.restore();
            shade(ctx, x, y, r, 0.65);
        },
        'anillo': (ctx, o, m, x, y, r, t) => {
            const tilt = 0.3;
            const rings = (from, to) => {
                [[0.55, 'rgba(232, 211, 166, 0.5)'], [0.7, 'rgba(210, 190, 150, 0.75)'], [0.85, 'rgba(240, 220, 180, 0.6)'], [0.97, 'rgba(200, 180, 140, 0.4)']].forEach(([f, c]) => {
                    ctx.strokeStyle = c;
                    ctx.lineWidth = lineWidth(r, 0.07);
                    ctx.beginPath();
                    if (o.k === 'arco') {
                        [0, 0.5, 1.1].forEach(a0 => {
                            const a = a0 + t * 0.1;
                            ctx.moveTo(x + Math.cos(a) * r * f, y + Math.sin(a) * r * f * tilt);
                            ctx.ellipse(x, y, r * f, r * f * tilt, 0, a, a + 0.25);
                        });
                    } else {
                        ctx.ellipse(x, y, r * f, r * f * tilt, 0, from, to);
                    }
                    ctx.stroke();
                });
            };
            if (o.k === 'polvo') {
                rings(0, TAU);
                glow(ctx, x, y, r * 0.2, '#FFF1C4', 1);
                return;
            }
            rings(Math.PI, TAU);
            if (o.k === 'arco') ball(ctx, x, y, r * 0.25, '#5B8CFF');
            else {
                ball(ctx, x, y, r * 0.42, '#E3C38F');
                shade(ctx, x, y, r * 0.42, 0.5);
            }
            rings(0, Math.PI);
        },
        'roca': (ctx, o, m, x, y, r, t) => {
            if (!m.path) {
                m.path = new Path2D(blobPath(m.rnd, 18, 0.62));
                m.path2 = new Path2D(blobPath(m.rnd, 14, 0.7));
                m.craters = diskPoints(m.rnd, 6, 0.6).map(p => [p[0], p[1], 0.06 + m.rnd() * 0.1]);
            }
            const color = o.k === 'helado' ? '#5A5550' : o.k === 'meteorito' ? '#3B3634' : '#8B7D6B';
            const rock = (px, py, rr, path) => {
                const g = ctx.createRadialGradient(px - rr * 0.4, py - rr * 0.4, rr * 0.1, px, py, rr * 1.1);
                g.addColorStop(0, d3.color(color).brighter(0.9).formatRgb());
                g.addColorStop(1, d3.color(color).darker(1.2).formatRgb());
                ctx.fillStyle = g;
                fillUnit(ctx, path, px, py, rr, t * 0.15 + m.seed * TAU);
            };
            if (o.k === 'binario') {
                const a = t * 0.5;
                rock(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.2, r * 0.5, m.path);
                rock(x - Math.cos(a) * r * 0.55, y - Math.sin(a) * r * 0.25, r * 0.32, m.path2);
                return;
            }
            rock(x, y, r, m.path);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
            m.craters.forEach(c => {
                ctx.beginPath();
                ctx.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, TAU);
                ctx.fill();
            });
            if (o.k === 'meteorito') {
                ctx.fillStyle = 'rgba(200, 200, 210, 0.6)';
                m.craters.forEach(c => ctx.fillRect(x + c[1] * r, y + c[0] * r, Math.max(1, r * 0.03), Math.max(1, r * 0.03)));
            }
        },
        'cometa': (ctx, o, m, x, y, r, t) => {
            const dust = ctx.createLinearGradient(x, y, x + r * 2.5, y + r * 0.6);
            dust.addColorStop(0, 'rgba(255, 240, 200, 0.6)');
            dust.addColorStop(1, 'rgba(255, 240, 200, 0)');
            ctx.fillStyle = dust;
            ctx.beginPath();
            ctx.moveTo(x, y - r * 0.3);
            ctx.quadraticCurveTo(x + r * 1.4, y - r * 0.1, x + r * 2.5, y + r * 0.9);
            ctx.lineTo(x + r * 2.5, y + r * 0.3);
            ctx.quadraticCurveTo(x + r * 1.4, y + r * 0.2, x, y + r * 0.3);
            ctx.fill();
            const ion = ctx.createLinearGradient(x, y, x + r * 3, y);
            ion.addColorStop(0, 'rgba(150, 200, 255, 0.7)');
            ion.addColorStop(1, 'rgba(150, 200, 255, 0)');
            ctx.fillStyle = ion;
            ctx.fillRect(x, y - r * 0.06, r * 3, r * 0.12);
            glow(ctx, x, y, r * 0.5, '#BFE9FF', 0.7);
            glow(ctx, x, y, r * 0.06, '#FFFFFF', 1);
        },
        'helado': (ctx, o, m, x, y, r, t) => {
            if (!m.path) m.path = new Path2D(blobPath(m.rnd, 16, 0.8));
            const color = o.c || '#D8C8B8';
            const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r * 1.1);
            g.addColorStop(0, d3.color(color).brighter(0.8).formatRgb());
            g.addColorStop(1, d3.color(color).darker(1.3).formatRgb());
            ctx.fillStyle = g;
            fillUnit(ctx, m.path, x, y, r, t * 0.1 + m.seed * TAU);
            glow(ctx, x - r * 0.3, y - r * 0.2, r * 0.3, '#FFFFFF', 0.35);
        },
        'relieve': (ctx, o, m, x, y, r, t) => {
            if (!m.terrain) {
                m.terrain = d3.range(41).map(i => Math.sin(i * 0.5 + m.seed * 9) * 0.04 + m.rnd() * 0.03);
                m.river = d3.range(12).map(i => [i / 11 * 2 - 1, (m.rnd() * 2 - 1) * 0.12]);
            }
            const ground = '#B5653A', groundDark = '#6E3A22';
            postcard(ctx, x, y, r, () => {
                const H = r * 0.75;
                const fillGround = (yy, color) => {
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.moveTo(x - r, y + H);
                    m.terrain.forEach((h, i) => ctx.lineTo(x - r + i / 40 * 2 * r, y + yy * r - h * r));
                    ctx.lineTo(x + r, y + H);
                    ctx.closePath();
                    ctx.fill();
                };
                switch (o.k) {
                    case 'montana':
                        polygon(ctx, [[-1, 0.75], [-0.55, -0.35], [-0.25, 0.1], [0.1, -0.55], [0.55, 0.05], [1, -0.2], [1, 0.75]], x, y, r, '#7A6A5E');
                        polygon(ctx, [[0.1, -0.55], [-0.02, -0.38], [0.22, -0.4]], x, y, r, '#F2F2F2');
                        polygon(ctx, [[-0.55, -0.35], [-0.63, -0.22], [-0.47, -0.24]], x, y, r, '#F2F2F2');
                        break;
                    case 'crater':
                        fillGround(0.15, ground);
                        ctx.fillStyle = groundDark;
                        ctx.beginPath();
                        ctx.ellipse(x, y + r * 0.3, r * 0.65, r * 0.18, 0, 0, TAU);
                        ctx.fill();
                        ctx.strokeStyle = '#E09A6A';
                        ctx.lineWidth = lineWidth(r, 0.02);
                        ctx.stroke();
                        polygon(ctx, [[-0.08, 0.32], [0, 0.22], [0.08, 0.32]], x, y, r, '#C77A4A');
                        break;
                    case 'valle':
                        polygon(ctx, [[-1, -0.3], [0, 0.45], [1, -0.25], [1, 0.75], [-1, 0.75]], x, y, r, '#8A5A3A');
                        polygon(ctx, [[-1, -0.3], [0, 0.45], [-1, 0.75]], x, y, r, '#A86C45');
                        break;
                    case 'canon':
                        ['#C9784A', '#B5653A', '#9C5332', '#86452A', '#6E3A22'].forEach((c, i) => {
                            polygon(ctx, [[-1, -0.35 + i * 0.2], [-0.15, -0.35 + i * 0.2], [-0.15, -0.15 + i * 0.2], [-1, -0.15 + i * 0.2]], x, y, r, c);
                            polygon(ctx, [[0.15, -0.35 + i * 0.2], [1, -0.35 + i * 0.2], [1, -0.15 + i * 0.2], [0.15, -0.15 + i * 0.2]], x, y, r, c);
                        });
                        break;
                    case 'volcan':
                        polygon(ctx, [[-1, 0.5], [-0.35, 0], [0.35, 0], [1, 0.5], [1, 0.75], [-1, 0.75]], x, y, r, '#9C5332');
                        ctx.fillStyle = '#5A2E1A';
                        ctx.beginPath();
                        ctx.ellipse(x, y, r * 0.3, r * 0.05, 0, 0, TAU);
                        ctx.fill();
                        break;
                    case 'llanura':
                        fillGround(0.05, ground);
                        break;
                    case 'duna':
                        for (let i = 0; i < 5; i++) {
                            ctx.fillStyle = i % 2 ? '#D9A066' : '#C48A52';
                            ctx.beginPath();
                            ctx.moveTo(x - r, y + r * 0.75);
                            for (let j = 0; j <= 40; j++) ctx.lineTo(x - r + j / 40 * 2 * r, y + r * (-0.1 + i * 0.18) + Math.sin(j * 0.6 + i) * r * 0.06);
                            ctx.lineTo(x + r, y + r * 0.75);
                            ctx.fill();
                        }
                        break;
                    case 'glaciar':
                        fillGround(0.1, '#6E6A70');
                        polygon(ctx, [[-0.6, 0.75], [-0.3, -0.2], [0.3, -0.2], [0.6, 0.75]], x, y, r, '#DCEBFA');
                        ctx.strokeStyle = 'rgba(120, 170, 220, 0.6)';
                        ctx.lineWidth = lineWidth(r, 0.01);
                        [-0.2, 0, 0.2].forEach(f => {
                            ctx.beginPath();
                            ctx.moveTo(x + f * r, y - r * 0.2);
                            ctx.lineTo(x + f * r * 1.8, y + r * 0.75);
                            ctx.stroke();
                        });
                        break;
                    case 'casquete':
                        ball(ctx, x, y + r * 0.2, r * 0.6, '#C1440E');
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                        ctx.beginPath();
                        ctx.ellipse(x, y - r * 0.28, r * 0.28, r * 0.08, 0, 0, TAU);
                        ctx.fill();
                        break;
                    case 'oceano':
                        ctx.fillStyle = '#123A6B';
                        ctx.fillRect(x - r, y - r * 0.1, r * 2, r);
                        ctx.fillStyle = '#DDEBF5';
                        ctx.fillRect(x - r, y - r * 0.35, r * 2, r * 0.25);
                        ctx.strokeStyle = 'rgba(180, 80, 60, 0.7)';
                        ctx.lineWidth = lineWidth(r, 0.008);
                        ctx.beginPath();
                        ctx.moveTo(x - r, y - r * 0.25);
                        ctx.lineTo(x + r, y - r * 0.2);
                        ctx.stroke();
                        wave(ctx, x - r, x + r, y + r * 0.3, r * 0.03, 6, t, 'rgba(120, 180, 255, 0.6)', lineWidth(r, 0.01));
                        break;
                    case 'mar':
                    case 'lago':
                        fillGround(0.1, '#C98A4A');
                        ctx.fillStyle = '#1E1A2E';
                        ctx.beginPath();
                        ctx.ellipse(x, y + r * 0.35, r * (o.k === 'mar' ? 0.9 : 0.45), r * (o.k === 'mar' ? 0.25 : 0.12), 0, 0, TAU);
                        ctx.fill();
                        break;
                    case 'rio':
                        fillGround(-0.1, '#C98A4A');
                        ctx.strokeStyle = '#2A2440';
                        ctx.lineWidth = lineWidth(r, 0.04);
                        ctx.beginPath();
                        d3.line().curve(d3.curveBasis).context(ctx)(m.river.map(p => [x + p[0] * r, y + r * 0.35 + p[1] * r]));
                        ctx.stroke();
                        break;
                    default:
                        fillGround(0.1, ground);
                }
            });
        },
        'atmosfera': (ctx, o, m, x, y, r, t) => {
            if (o.k === 'tormenta') {
                ctx.fillStyle = '#D9A36B';
                ctx.fillRect(x - r * 1.4, y - r * 0.8, r * 2.8, r * 1.6);
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(1, 0.6);
                const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
                g.addColorStop(0, '#E07040');
                g.addColorStop(1, 'rgba(200, 90, 50, 0.4)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 220, 190, 0.5)';
                ctx.lineWidth = lineWidth(r, 0.02);
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    for (let j = 0; j <= 60; j++) {
                        const a = j / 60 * 3 * Math.PI + t * 0.5 + i * 2;
                        const d = r * (0.15 + j / 60 * 0.8);
                        if (j) ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); else ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
                    }
                    ctx.stroke();
                }
                ctx.restore();
                return;
            }
            if (o.k === 'nube') {
                [[-0.4, 0.1, 0.4], [0, -0.1, 0.5], [0.4, 0.1, 0.4], [0.15, 0.2, 0.35], [-0.2, 0.25, 0.35]].forEach(c => ball(ctx, x + c[0] * r, y + c[1] * r, c[2] * r, '#F5F7FA'));
                return;
            }
            // Atmósfera vista de canto, con sus capas
            const layers = ['Troposfera', 'Estratosfera', 'Mesosfera', 'Termosfera', 'Ionosfera', 'Exosfera'];
            const current = layers.indexOf(o.n);
            const planetR = r;
            const cy = y + r * 0.8;
            layers.forEach((name, i) => {
                const outer = planetR + r * (0.1 + i * 0.09);
                const highlight = current === i || (current < 0 && o.k === 'capa' && i === 2);
                ctx.fillStyle = highlight ? 'rgba(120, 200, 255, 0.55)' : `rgba(100, 160, 255, ${0.16 - i * 0.02})`;
                ctx.beginPath();
                ctx.arc(x, cy, outer, Math.PI * 1.15, Math.PI * 1.85);
                ctx.arc(x, cy, outer - r * 0.09, Math.PI * 1.85, Math.PI * 1.15, true);
                ctx.fill();
            });
            const g = ctx.createRadialGradient(x, cy, planetR * 0.9, x, cy, planetR);
            g.addColorStop(0, '#1F4E8A');
            g.addColorStop(1, '#4F8FE0');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, cy, planetR, Math.PI * 1.1, Math.PI * 1.9);
            ctx.lineTo(x, cy);
            ctx.fill();
        },
        'interior-estelar': (ctx, o, m, x, y, r, t) => {
            const order = ['nucleo', 'radiativa', 'convectiva', 'fotosfera', 'cromosfera', 'corona'];
            const h = order.indexOf(o.k);
            glow(ctx, x, y, r * 1.8, '#FFB347', h === 5 ? 0.6 : 0.25);
            cutaway(ctx, x, y, r, [[1.02, '#FF6B3A'], [1, '#FFB347'], [0.7, '#FFD27A'], [0.25, '#FFFBE8']], h <= 2 ? 3 - h : h === 3 ? 1 : h === 4 ? 0 : -1);
        },
        'interior-planetario': (ctx, o, m, x, y, r, t) => {
            if (o.k === 'placa') {
                if (!m.plates) m.plates = d3.range(7).map(() => d3.geoCircle().center([m.rnd() * 360 - 180, m.rnd() * 140 - 70]).radius(25 + m.rnd() * 35)());
                projection.scale(r).translate([x, y]).rotate([t * 6, -15]);
                geoPath.context(ctx);
                ctx.beginPath();
                geoPath({ type: 'Sphere' });
                ctx.fillStyle = '#8A6A50';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 120, 60, 0.8)';
                ctx.lineWidth = lineWidth(r, 0.012);
                m.plates.forEach(p => {
                    ctx.beginPath();
                    geoPath(p);
                    ctx.stroke();
                });
                shade(ctx, x, y, r, 0.55);
                return;
            }
            const order = ['nucleo', 'manto', 'corteza'];
            const h = order.indexOf(o.k);
            cutaway(ctx, x, y, r, [[1, '#8A6A50'], [0.97, '#E2582B'], [0.55, '#FF9A3C'], [0.2, '#FFE066']], h === 0 ? 2 : h === 1 ? 1 : 0);
        },
        'material': (ctx, o, m, x, y, r, t) => {
            if (o.k === 'cristal') {
                const hex = d3.range(6).map(i => [Math.cos(i / 6 * TAU) * 0.55, Math.sin(i / 6 * TAU) * 0.3]);
                const top = hex.map(p => [p[0], p[1] - 0.45]);
                const bottom = hex.map(p => [p[0], p[1] + 0.45]);
                for (let i = 0; i < 6; i++) {
                    const j = (i + 1) % 6;
                    if (top[i][1] + top[j][1] < -0.9) continue;
                    polygon(ctx, [top[i], top[j], bottom[j], bottom[i]], x, y, r, d3.interpolateRgb('#7E57C2', '#B39DDB')(i / 6));
                }
                polygon(ctx, top, x, y, r, '#D1C4E9');
                return;
            }
            if (o.k === 'hielo') {
                ctx.strokeStyle = '#D6F0FF';
                ctx.lineWidth = lineWidth(r, 0.05);
                ctx.lineCap = 'round';
                for (let i = 0; i < 6; i++) {
                    const a = i / 6 * TAU + t * 0.1;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
                    [0.45, 0.7].forEach(f => {
                        const bx = x + Math.cos(a) * r * f, by = y + Math.sin(a) * r * f;
                        ctx.moveTo(bx, by);
                        ctx.lineTo(bx + Math.cos(a + 0.6) * r * 0.25, by + Math.sin(a + 0.6) * r * 0.25);
                        ctx.moveTo(bx, by);
                        ctx.lineTo(bx + Math.cos(a - 0.6) * r * 0.25, by + Math.sin(a - 0.6) * r * 0.25);
                    });
                    ctx.stroke();
                }
                return;
            }
            if (!m.grains) {
                const n = o.k === 'regolito' ? 40 : o.k === 'polvo' ? 26 : 1;
                m.grains = (n === 1 ? [[0, 0, 1]] : packModel(n, m.rnd).map(c => [c.x, c.y, c.r * (o.k === 'polvo' ? 1 : 0.95)]))
                    .map(g => ({ g: g, path: new Path2D(blobPath(m.rnd, 10, o.k === 'polvo' ? 0.9 : 0.6)) }));
            }
            const color = o.k === 'polvo' ? '#8D7B6A' : '#A8977F';
            m.grains.forEach(({ g, path }) => {
                const px = x + g[0] * r, py = y + g[1] * r, rr = g[2] * r;
                const grad = ctx.createRadialGradient(px - rr * 0.4, py - rr * 0.4, rr * 0.1, px, py, rr);
                grad.addColorStop(0, d3.color(color).brighter(0.9).formatRgb());
                grad.addColorStop(1, d3.color(color).darker(1.1).formatRgb());
                ctx.fillStyle = grad;
                fillUnit(ctx, path, px, py, rr, m.seed * 7);
            });
        },
        'gas': (ctx, o, m, x, y, r, t) => {
            if (!m.parts) m.parts = diskPoints(m.rnd, 60, 0.85).map(p => [p[0], p[1], m.rnd() * TAU, m.rnd()]);
            glow(ctx, x, y, r, '#5B6CFF', 0.12);
            m.parts.forEach(p => {
                const fast = o.k === 'plasma' || o.k === 'ionizado';
                const px = x + (p[0] + Math.sin(t * (fast ? 2 : 0.8) + p[2]) * 0.06) * r;
                const py = y + (p[1] + Math.cos(t * (fast ? 2.3 : 0.9) + p[2]) * 0.06) * r;
                if (o.k === 'molecular') {
                    const a = t + p[2];
                    ball(ctx, px - Math.cos(a) * r * 0.02, py - Math.sin(a) * r * 0.02, r * 0.018, '#9FB8FF');
                    ball(ctx, px + Math.cos(a) * r * 0.02, py + Math.sin(a) * r * 0.02, r * 0.018, '#9FB8FF');
                } else if (fast) {
                    ball(ctx, px, py, r * (p[3] < 0.5 ? 0.025 : 0.012), p[3] < 0.5 ? '#FF7A7A' : '#7FC8FF');
                } else {
                    ball(ctx, px, py, r * 0.02, '#C9D6FF');
                }
            });
        },
        'campo': (ctx, o, m, x, y, r, t) => {
            if (o.k === 'gravitacional') {
                ctx.strokeStyle = 'rgba(127, 219, 255, 0.45)';
                ctx.lineWidth = 1;
                for (let i = 1; i <= 7; i++) {
                    const rr = i / 7;
                    const depth = 0.35 / (0.3 + rr * 3);
                    ctx.beginPath();
                    ctx.ellipse(x, y + depth * r, rr * r, rr * r * 0.35, 0, 0, TAU);
                    ctx.stroke();
                }
                for (let i = 0; i < 12; i++) {
                    const a = i / 12 * TAU;
                    ctx.beginPath();
                    for (let j = 1; j <= 20; j++) {
                        const rr = j / 20;
                        const px = x + Math.cos(a) * rr * r, py = y + Math.sin(a) * rr * r * 0.35 + 0.35 / (0.3 + rr * 3) * r;
                        if (j > 1) ctx.lineTo(px, py); else ctx.moveTo(px, py);
                    }
                    ctx.stroke();
                }
                glow(ctx, x, y + r * 0.35 / 0.3 * 0.25, r * 0.12, '#FFF1C4', 1);
                return;
            }
            const planet = r * (o.k === 'magnetico' ? 0.18 : 0.1);
            if (o.k === 'cinturon') {
                ['rgba(255, 120, 120, 0.35)', 'rgba(120, 180, 255, 0.3)'].forEach((c, i) => {
                    ctx.strokeStyle = c;
                    ctx.lineWidth = r * 0.12;
                    ctx.beginPath();
                    ctx.ellipse(x, y, r * (0.4 + i * 0.4), r * (0.4 + i * 0.4) * 0.45, 0, 0, TAU);
                    ctx.stroke();
                });
            } else {
                ctx.strokeStyle = 'rgba(127, 219, 255, 0.55)';
                ctx.lineWidth = lineWidth(r, 0.008);
                [0.35, 0.55, 0.75, 0.95].forEach(L => {
                    [-1, 1].forEach(side => {
                        ctx.beginPath();
                        for (let i = 0; i <= 40; i++) {
                            const th = 0.15 + i / 40 * (Math.PI - 0.3);
                            let d = L * Math.sin(th) ** 2;
                            if (o.k === 'magnetosfera') d *= side < 0 ? 0.7 : 1.6;
                            const px = x + side * d * Math.sin(th) * r, py = y - d * Math.cos(th) * r;
                            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
                        }
                        ctx.stroke();
                    });
                });
                if (o.k === 'magnetosfera') {
                    ctx.strokeStyle = 'rgba(255, 220, 150, 0.6)';
                    ctx.beginPath();
                    ctx.arc(x - r * 0.15, y, r * 0.7, Math.PI * 0.65, Math.PI * 1.35);
                    ctx.stroke();
                }
            }
            drawPlanet(ctx, { k: 'terrestre', c: '#4F8FE0' }, m, x, y, planet, t);
        },
        'onda': (ctx, o, m, x, y, r, t) => {
            if (o.k === 'gravitacional') {
                for (let i = 0; i < 6; i++) {
                    const rr = ((i / 6 + t * 0.15) % 1) * r;
                    ctx.strokeStyle = `rgba(255, 213, 79, ${0.6 * (1 - rr / r)})`;
                    ctx.lineWidth = lineWidth(r, 0.015);
                    ctx.beginPath();
                    ctx.ellipse(x, y, rr, rr * 0.5, 0, 0, TAU);
                    ctx.stroke();
                }
                const a = t * 3;
                glow(ctx, x + Math.cos(a) * r * 0.06, y + Math.sin(a) * r * 0.03, r * 0.05, '#FFFFFF', 0.9);
                glow(ctx, x - Math.cos(a) * r * 0.06, y - Math.sin(a) * r * 0.03, r * 0.05, '#FFFFFF', 0.9);
                return;
            }
            const color = o.k === 'fondo' ? 'rgba(255, 140, 90, 0.9)' : 'rgba(255, 90, 90, 0.9)';
            wave(ctx, x - r, x + r, y, r * 0.35, 1, t * 2, color, lineWidth(r, 0.02));
            if (o.k === 'luz') wave(ctx, x - r, x + r, y, r * 0.15, 1, t * 2 + Math.PI / 2, 'rgba(90, 150, 255, 0.8)', lineWidth(r, 0.015));
        },
        'flujo': (ctx, o, m, x, y, r, t) => {
            if (o.k === 'rayo') {
                const g = ctx.createLinearGradient(x, y, x - r * 6, y - r * 3);
                g.addColorStop(0, 'rgba(255, 233, 168, 0.8)');
                g.addColorStop(1, 'rgba(255, 233, 168, 0)');
                ctx.strokeStyle = g;
                ctx.lineWidth = r * 0.6;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x - r * 6, y - r * 3);
                ctx.stroke();
                glow(ctx, x, y, r * 2.5, '#FFE9A8', 0.6);
                ball(ctx, x, y, r, '#FF6B6B');
                return;
            }
            if (!m.rays) m.rays = d3.range(48).map(() => [m.rnd() * TAU, m.rnd()]);
            glow(ctx, x, y, r * 0.15, '#FFF1C4', 1);
            ctx.strokeStyle = 'rgba(255, 233, 168, 0.45)';
            ctx.lineWidth = lineWidth(r, 0.004);
            m.rays.forEach(([a, p]) => {
                const d = ((p + t * 0.15) % 1) * r;
                ctx.beginPath();
                ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
                ctx.lineTo(x + Math.cos(a) * (d + r * 0.12), y + Math.sin(a) * (d + r * 0.12));
                ctx.stroke();
            });
            ctx.strokeStyle = 'rgba(127, 240, 208, 0.3)';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.stroke();
        },
        'actividad': (ctx, o, m, x, y, r, t) => {
            const limbR = r * 2.4;
            const cy = y + limbR * 0.9;
            const g = ctx.createRadialGradient(x, cy, limbR * 0.6, x, cy, limbR);
            g.addColorStop(0, '#FFE29A');
            g.addColorStop(1, '#FF8C42');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, cy, limbR, Math.PI, TAU);
            ctx.fill();
            glow(ctx, x, cy - limbR, r * 0.8, '#FF8C42', 0.3);
            const top = cy - limbR;
            switch (o.k) {
                case 'protuberancia':
                case 'cme':
                    ctx.strokeStyle = o.k === 'cme' ? 'rgba(255, 210, 190, 0.6)' : 'rgba(255, 90, 60, 0.85)';
                    ctx.lineWidth = lineWidth(r, o.k === 'cme' ? 0.04 : 0.12);
                    ctx.beginPath();
                    ctx.ellipse(x, top, r * (o.k === 'cme' ? 0.9 : 0.5), r * (o.k === 'cme' ? 1 : 0.7), 0, Math.PI, TAU);
                    ctx.stroke();
                    break;
                case 'mancha':
                    ctx.fillStyle = 'rgba(90, 40, 10, 0.6)';
                    ctx.beginPath();
                    ctx.ellipse(x, top + r * 0.7, r * 0.6, r * 0.35, 0, 0, TAU);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(30, 10, 0, 0.85)';
                    ctx.beginPath();
                    ctx.ellipse(x, top + r * 0.7, r * 0.3, r * 0.17, 0, 0, TAU);
                    ctx.fill();
                    break;
                case 'llamarada':
                    glow(ctx, x, top + r * 0.1, r * (0.6 + 0.3 * Math.abs(Math.sin(t * 2))), '#FFFFFF', 0.95);
                    break;
                default:
                    glow(ctx, x, top + r * 0.5, r * 0.5, '#FFFFFF', 0.9);
            }
        },
        'evento': (ctx, o, m, x, y, r, t) => {
            if (!m.rays) m.rays = d3.range(28).map(() => [m.rnd() * TAU, 0.5 + m.rnd() * 0.5]);
            const color = o.c || '#FFFFFF';
            ctx.globalCompositeOperation = 'lighter';
            if (o.k === 'grb') {
                const g = ctx.createLinearGradient(x, y - r, x, y + r);
                g.addColorStop(0, 'rgba(185, 162, 255, 0)');
                g.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
                g.addColorStop(1, 'rgba(185, 162, 255, 0)');
                ctx.fillStyle = g;
                ctx.fillRect(x - r * 0.04, y - r, r * 0.08, r * 2);
            } else {
                const shell = (0.55 + ((t * 0.12) % 0.45)) * r;
                ctx.strokeStyle = rgba(color, 0.5);
                ctx.lineWidth = lineWidth(r, 0.02);
                ctx.beginPath();
                ctx.arc(x, y, shell, 0, TAU);
                ctx.stroke();
                ctx.strokeStyle = rgba(color, 0.55);
                ctx.lineWidth = lineWidth(r, 0.008);
                m.rays.forEach(([a, l]) => {
                    ctx.beginPath();
                    ctx.moveTo(x + Math.cos(a) * r * 0.1, y + Math.sin(a) * r * 0.1);
                    ctx.lineTo(x + Math.cos(a) * r * l, y + Math.sin(a) * r * l);
                    ctx.stroke();
                });
            }
            glow(ctx, x, y, r * 0.45, color, 0.9);
            glow(ctx, x, y, r * 0.12, '#FFFFFF', 1);
        },
        'pilar': (ctx, o, m, x, y, r) => {
            const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.2);
            g.addColorStop(0, 'rgba(90, 200, 190, 0.45)');
            g.addColorStop(1, 'rgba(90, 200, 190, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
            [[-0.45, 0.25, 1], [0, 0.18, 0.75], [0.4, 0.14, 0.5]].forEach(([px, w, h]) => {
                polygon(ctx, [[px - w, 1], [px - w * 0.6, 1 - h * 1.6], [px, 1 - h * 1.9], [px + w * 0.6, 1 - h * 1.6], [px + w, 1]], x, y, r, 'rgba(92, 52, 32, 0.95)');
                ctx.strokeStyle = 'rgba(255, 170, 110, 0.7)';
                ctx.lineWidth = lineWidth(r, 0.01);
                ctx.stroke();
            });
        },
        'choque': (ctx, o, m, x, y, r) => {
            if (o.k === 'terminacion') {
                glow(ctx, x, y, r * 0.1, '#FFF1C4', 1);
                ctx.strokeStyle = 'rgba(127, 240, 208, 0.7)';
                ctx.lineWidth = lineWidth(r, 0.015);
                ctx.beginPath();
                ctx.arc(x, y, r * 0.7, 0, TAU);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(127, 178, 255, 0.35)';
                ctx.beginPath();
                ctx.ellipse(x + r * 0.15, y, r, r * 0.9, 0, 0, TAU);
                ctx.stroke();
                return;
            }
            ball(ctx, x + r * 0.4, y, r * 0.06, '#FFF1C4');
            ctx.strokeStyle = 'rgba(127, 240, 208, 0.8)';
            ctx.lineWidth = lineWidth(r, 0.03);
            ctx.beginPath();
            d3.line().curve(d3.curveBasis).context(ctx)([[x + r, y - r * 0.9], [x + r * 0.05, y - r * 0.35], [x - r * 0.1, y], [x + r * 0.05, y + r * 0.35], [x + r, y + r * 0.9]]);
            ctx.stroke();
        },
        'filamento': (ctx, o, m, x, y, r) => {
            if (!m.strands) m.strands = d3.range(6).map(() => d3.range(9).map(i => [i / 8 * 2 - 1, (m.rnd() * 2 - 1) * 0.3]));
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = rgba(o.c || DOT.filamento, 0.4);
            ctx.lineWidth = lineWidth(r, 0.02);
            ctx.lineCap = 'round';
            m.strands.forEach(s => {
                ctx.beginPath();
                d3.line().curve(d3.curveBasis).context(ctx)(s.map(p => [x + p[0] * r, y + p[1] * r]));
                ctx.stroke();
            });
        },
        'materia-oscura': (ctx, o, m, x, y, r) => {
            if (o.k === 'filamento') {
                if (!m.web) m.web = webModel(m.rnd, 'filamento');
                drawWeb(ctx, m.web, x, y, r, '#B39DFF', true, 0.6);
                return;
            }
            if (!m.specks) m.specks = (o.k === 'grumo' ? gaussPoints(m.rnd, 160, 0.3) : diskPoints(m.rnd, 160, 0.95));
            ctx.fillStyle = 'rgba(179, 157, 255, 0.35)';
            const s = Math.max(0.7, r * 0.006);
            m.specks.forEach(p => ctx.fillRect(x + p[0] * r, y + p[1] * r, s, s));
            ctx.strokeStyle = 'rgba(179, 157, 255, 0.7)';
            ctx.setLineDash([lineWidth(r, 0.03), lineWidth(r, 0.025)]);
            ctx.lineWidth = lineWidth(r, 0.006);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.stroke();
            ctx.setLineDash([]);
            if (o.k === 'halo') {
                if (!m.gal) m.gal = spiralModel(m.rnd, false);
                ctx.globalCompositeOperation = 'lighter';
                drawSpiral(ctx, m.gal, x, y, r * 0.15, '#FFE8C0', 0, 0.55, 0.8);
            }
        },
        'particula': (ctx, o, m, x, y, r, t) => {
            let color = PARTICLE_COLOR[o.k] || '#FFFFFF';
            if (o.k === 'quark') color = QUARK_COLORS[Math.floor(m.seed * 3)];
            if (o.k === 'antiquark') color = ANTIQUARK_COLORS[Math.floor(m.seed * 3)];
            if (o.k === 'foton') {
                glow(ctx, x, y, r * 1.5, color, 0.4);
                wave(ctx, x - r * 1.2, x + r * 1.2, y, r * 0.3, 3, t * 6, color, lineWidth(r, 0.08));
                return;
            }
            glow(ctx, x, y, r * 2.8, color, 0.35);
            const dashed = o.k === 'virtual' || o.k === 'oscura' || o.k === 'antiquark' || o.k === 'antilepton' || o.k === 'anti';
            if (dashed && o.k !== 'antiquark' && o.k !== 'antilepton' && o.k !== 'anti') {
                ctx.strokeStyle = rgba(color, 0.9);
                ctx.setLineDash([lineWidth(r, 0.25), lineWidth(r, 0.2)]);
                ctx.lineWidth = lineWidth(r, 0.08);
                ctx.beginPath();
                ctx.arc(x, y, r, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                ball(ctx, x, y, r, color);
                if (dashed) {
                    // Antipartícula: anillo exterior
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.lineWidth = lineWidth(r, 0.08);
                    ctx.beginPath();
                    ctx.arc(x, y, r * 1.25, 0, TAU);
                    ctx.stroke();
                }
            }
            if (o.k === 'higgs') {
                ctx.strokeStyle = 'rgba(255, 179, 0, 0.4)';
                ctx.lineWidth = lineWidth(r, 0.05);
                [1.6, 2.2].forEach(f => {
                    ctx.beginPath();
                    ctx.arc(x, y, r * (f + 0.2 * Math.sin(t * 3)), 0, TAU);
                    ctx.stroke();
                });
            }
            // Espín
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = lineWidth(r, 0.04);
            ctx.beginPath();
            ctx.ellipse(x, y, r * 1.5, r * 0.4, -0.4, t * 3, t * 3 + 4.5);
            ctx.stroke();
        },
        'hadron': (ctx, o, m, x, y, r, t) => {
            const anti = o.k === 'antiproton' || o.k === 'antineutron';
            const bag = o.k === 'neutron' || o.k === 'antineutron' ? '#7FA7C9' : '#FF6B6B';
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, rgba(bag, 0.5));
            g.addColorStop(1, rgba(bag, 0.05));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.fill();
            if (anti) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.lineWidth = lineWidth(r, 0.02);
                ctx.stroke();
            }
            const colors = anti ? ANTIQUARK_COLORS : QUARK_COLORS;
            const pts = d3.range(3).map(i => {
                const a = i / 3 * TAU + t * 0.8;
                return [x + Math.cos(a) * r * 0.42 + Math.sin(t * 3 + i) * r * 0.04, y + Math.sin(a) * r * 0.42];
            });
            pts.forEach((p, i) => {
                const q = pts[(i + 1) % 3];
                const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
                const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
                ctx.save();
                ctx.translate(p[0], p[1]);
                ctx.rotate(ang);
                wave(ctx, 0, len, 0, r * 0.04, 5, t * 8, 'rgba(255, 255, 255, 0.5)', lineWidth(r, 0.015));
                ctx.restore();
            });
            pts.forEach((p, i) => {
                if (o.k === 'confinado' && i === 0) glow(ctx, p[0], p[1], r * 0.35, colors[i], 0.8);
                ball(ctx, p[0], p[1], r * 0.14, colors[i]);
            });
        },
        'nucleo': (ctx, o, m, x, y, r) => {
            if (!m.pack) m.pack = packModel(o.k === 'isotopo' ? 26 : 22, m.rnd);
            m.pack.forEach((c, i) => ball(ctx, x + c.x * r, y + c.y * r, c.r * r, c.kind < (o.k === 'isotopo' ? 0.4 : 0.5) ? '#FF5A5F' : '#7FA7C9'));
        },
        'atomo': (ctx, o, m, x, y, r, t) => {
            const anti = o.k === 'anti';
            glow(ctx, x, y, r, anti ? '#FF5FD1' : '#7FC8FF', 0.18);
            const orbits = o.k === 'excitado' ? [0.4, 0.95] : [0.45, 0.8];
            orbits.forEach((f, i) => {
                const rot = i * 1.1 + 0.4;
                const missing = (o.k === 'ion') && i === 1;
                ctx.strokeStyle = missing ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.4)';
                if (missing) ctx.setLineDash([4, 4]);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(x, y, r * f, r * f * 0.35, rot, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);
                if (missing) return;
                const a = t * (2 - i * 0.6) + i * 2;
                const ex = Math.cos(a) * r * f, ey = Math.sin(a) * r * f * 0.35;
                ball(ctx, x + ex * Math.cos(rot) - ey * Math.sin(rot), y + ex * Math.sin(rot) + ey * Math.cos(rot), Math.max(1.5, r * 0.04), anti ? '#FF5FD1' : '#4FC3FF');
            });
            glow(ctx, x, y, r * 0.12, anti ? '#7FA7C9' : '#FF8A80', 0.9);
            ball(ctx, x, y, Math.max(1.5, r * 0.05), anti ? '#7FA7C9' : '#FF5A5F');
        },
        'molecula': (ctx, o, m, x, y, r, t) => {
            if (!m.mol) m.mol = moleculeModel(o.f, m.rnd);
            const rot = t * 0.25 + m.seed * TAU;
            const cr = Math.cos(rot), sr = Math.sin(rot);
            const pos = n => [x + (n.x * cr - n.y * sr) * r, y + (n.x * sr + n.y * cr) * r];
            ctx.strokeStyle = 'rgba(220, 220, 230, 0.8)';
            ctx.lineWidth = lineWidth(r, 0.07);
            ctx.lineCap = 'round';
            m.mol.links.forEach(l => {
                const a = pos(l.source), b = pos(l.target);
                ctx.beginPath();
                ctx.moveTo(a[0], a[1]);
                ctx.lineTo(b[0], b[1]);
                ctx.stroke();
            });
            m.mol.nodes.forEach(n => {
                const p = pos(n);
                ball(ctx, p[0], p[1], n.r * r, ELEMENT[n.e][0]);
            });
        },
        'agregado': (ctx, o, m, x, y, r, t) => {
            if (o.k === 'cristal') {
                for (let i = -3; i <= 3; i++) {
                    for (let j = -3; j <= 3; j++) {
                        const px = x + (i + j) * r * 0.13, py = y + (j - i) * r * 0.075;
                        if (Math.hypot(px - x, py - y) > r) continue;
                        ball(ctx, px, py, r * 0.06, (i + j) % 2 ? '#80DEEA' : '#B2EBF2');
                    }
                }
                return;
            }
            if (o.k === 'cluster' || o.k === 'coloide' || o.k === 'complejo') {
                if (!m.pack) m.pack = packModel(o.k === 'coloide' ? 1 : 30, m.rnd);
                if (o.k === 'coloide') {
                    glow(ctx, x, y, r * 1.3, '#C5E1A5', 0.35);
                    ball(ctx, x, y, r * 0.8, '#9CCC65');
                    return;
                }
                m.pack.forEach(c => ball(ctx, x + c.x * r, y + c.y * r, c.r * r, o.k === 'complejo' ? d3.interpolateViridis(c.kind) : (c.kind < 0.5 ? '#FFD54F' : '#B0BEC5')));
                return;
            }
            if (!m.chain) {
                const n = o.k === 'polimero' ? 24 : 70;
                let a = 0, px = -0.6, py = 0;
                m.chain = d3.range(n).map(i => {
                    if (o.k === 'polimero') return [i / (n - 1) * 1.8 - 0.9, i % 2 ? 0.08 : -0.08];
                    a += (m.rnd() * 2 - 1) * 1.2;
                    px = Math.max(-0.85, Math.min(0.85, px + Math.cos(a) * 0.09));
                    py = Math.max(-0.85, Math.min(0.85, py + Math.sin(a) * 0.09));
                    return [px, py];
                });
            }
            ctx.strokeStyle = 'rgba(220, 220, 230, 0.5)';
            ctx.lineWidth = lineWidth(r, 0.02);
            ctx.beginPath();
            d3.line().curve(d3.curveCatmullRom).context(ctx)(m.chain.map(p => [x + p[0] * r, y + p[1] * r]));
            ctx.stroke();
            m.chain.forEach((p, i) => ball(ctx, x + p[0] * r, y + p[1] * r, r * (o.k === 'polimero' ? 0.05 : 0.04), o.k === 'polimero' ? (i % 4 < 2 ? '#7D8590' : '#FF4D4D') : d3.interpolateTurbo(i / m.chain.length)));
        },
        'cuasiparticula': (ctx, o, m, x, y, r, t) => {
            const n = 7;
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    let px = (i / (n - 1) * 2 - 1) * 0.8, py = (j / (n - 1) * 2 - 1) * 0.8;
                    if (o.k === 'fonon') px += Math.sin(px * 4 - t * 3) * 0.05;
                    if (o.k === 'polaron') {
                        const d = Math.hypot(px, py);
                        px *= 1 - 0.18 * Math.exp(-d * d * 6);
                        py *= 1 - 0.18 * Math.exp(-d * d * 6);
                    }
                    if (o.k === 'magnon') {
                        const a = Math.sin(px * 3 - t * 2) * 0.8;
                        ctx.strokeStyle = 'rgba(128, 222, 234, 0.8)';
                        ctx.lineWidth = lineWidth(r, 0.015);
                        ctx.beginPath();
                        ctx.moveTo(x + px * r, y + py * r);
                        ctx.lineTo(x + (px + Math.sin(a) * 0.1) * r, y + (py - Math.cos(a) * 0.1) * r);
                        ctx.stroke();
                    }
                    const plasma = o.k === 'plasmon' ? 0.5 + 0.5 * Math.sin(px * 4 - t * 3) : 1;
                    ctx.globalAlpha = 0.4 + 0.6 * plasma;
                    ball(ctx, x + px * r, y + py * r, r * 0.035, '#80DEEA');
                    ctx.globalAlpha = 1;
                }
            }
            if (o.k === 'exciton' || o.k === 'cooper' || o.k === 'polaron') {
                const a = t * 1.5;
                const e1 = [x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25];
                const e2 = [x - Math.cos(a) * r * 0.25, y - Math.sin(a) * r * 0.25];
                if (o.k === 'polaron') {
                    ball(ctx, x, y, r * 0.08, '#4FC3FF');
                    return;
                }
                if (o.k === 'cooper') {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.lineWidth = lineWidth(r, 0.01);
                    ctx.beginPath();
                    ctx.moveTo(e1[0], e1[1]);
                    ctx.lineTo(e2[0], e2[1]);
                    ctx.stroke();
                }
                ball(ctx, e1[0], e1[1], r * 0.07, '#4FC3FF');
                if (o.k === 'cooper') {
                    ball(ctx, e2[0], e2[1], r * 0.07, '#4FC3FF');
                } else {
                    ctx.strokeStyle = '#FF5252';
                    ctx.lineWidth = lineWidth(r, 0.02);
                    ctx.beginPath();
                    ctx.arc(e2[0], e2[1], r * 0.07, 0, TAU);
                    ctx.stroke();
                }
            }
        },
        'cuantico': (ctx, o, m, x, y, r, t) => {
            switch (o.k) {
                case 'vortice':
                    ctx.strokeStyle = 'rgba(225, 190, 231, 0.6)';
                    ctx.lineWidth = lineWidth(r, 0.012);
                    for (let i = 0; i < 4; i++) {
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.beginPath();
                        d3.lineRadial().curve(d3.curveCatmullRom).context(ctx)(d3.range(40).map(j => [j / 40 * 3 * Math.PI + i * Math.PI / 2 - t, (0.05 + j / 40 * 0.95) * r]));
                        ctx.restore();
                        ctx.stroke();
                    }
                    break;
                case 'estado':
                    if (!m.cloud) m.cloud = gaussPoints(m.rnd, 500, 0.22).map(p => [p[0] + (p[0] > 0 ? 0.35 : -0.35), p[1] * 0.7]);
                    ctx.fillStyle = 'rgba(225, 190, 231, 0.45)';
                    m.cloud.forEach(p => ctx.fillRect(x + p[0] * r, y + p[1] * r, Math.max(0.8, r * 0.008), Math.max(0.8, r * 0.008)));
                    ball(ctx, x, y, Math.max(1.5, r * 0.03), '#FF5A5F');
                    break;
                case 'excitacion':
                case 'exotica': {
                    ctx.strokeStyle = o.k === 'exotica' ? 'rgba(186, 104, 200, 0.9)' : 'rgba(225, 190, 231, 0.9)';
                    ctx.lineWidth = lineWidth(r, 0.02);
                    ctx.beginPath();
                    for (let i = 0; i <= 120; i++) {
                        const u = i / 120 * 2 - 1;
                        const env = Math.exp(-((u - Math.sin(t) * 0.3) ** 2) * 8);
                        const py = y + Math.sin(u * 14 - t * 6) * env * r * 0.4;
                        if (i) ctx.lineTo(x + u * r, py); else ctx.moveTo(x + u * r, py);
                    }
                    ctx.stroke();
                    break;
                }
                case 'defecto':
                    for (let i = -4; i <= 4; i++) {
                        for (let j = -4; j <= 4; j++) {
                            if (i === 0 && j < 0) continue;
                            const shift = j < 0 ? (i > 0 ? 0.5 : -0.5) * 0.18 * Math.max(0, 1 - Math.abs(i) / 4) : 0;
                            ball(ctx, x + (i * 0.2 + shift) * r, y + j * 0.2 * r, r * 0.04, '#CE93D8');
                        }
                    }
                    break;
                case 'campo':
                    ctx.strokeStyle = 'rgba(225, 190, 231, 0.7)';
                    ctx.lineWidth = lineWidth(r, 0.01);
                    for (let i = -4; i <= 4; i++) {
                        for (let j = -4; j <= 4; j++) {
                            const px = x + i * 0.2 * r, py = y + j * 0.2 * r;
                            const a = Math.sin(i * 0.8 + j * 0.5 - t * 2) * Math.PI;
                            ctx.beginPath();
                            ctx.moveTo(px, py);
                            ctx.lineTo(px + Math.cos(a) * r * 0.08, py + Math.sin(a) * r * 0.08);
                            ctx.stroke();
                        }
                    }
                    break;
                case 'fluctuacion':
                    if (!m.foam) m.foam = diskPoints(m.rnd, 40, 0.9).map(p => [p[0], p[1], m.rnd() * TAU, 0.04 + m.rnd() * 0.1]);
                    m.foam.forEach(f => {
                        const life = Math.max(0, Math.sin(t * 1.5 + f[2]));
                        ctx.strokeStyle = `rgba(225, 190, 231, ${0.7 * life})`;
                        ctx.lineWidth = lineWidth(r, 0.006);
                        ctx.beginPath();
                        ctx.arc(x + f[0] * r, y + f[1] * r, f[3] * r * life, 0, TAU);
                        ctx.stroke();
                    });
                    break;
                case 'planck':
                default: {
                    const n = 12;
                    const cell = r * 2 / n;
                    for (let i = 0; i < n; i++) {
                        for (let j = 0; j < n; j++) {
                            const v = 0.5 + 0.5 * Math.sin(i * 12.9898 + j * 78.233 + Math.floor(t * 4) * 0.7);
                            ctx.fillStyle = `rgba(225, 190, 231, ${0.08 + 0.4 * (v % 1)})`;
                            ctx.fillRect(x - r + i * cell, y - r + j * cell, cell - 1, cell - 1);
                        }
                    }
                }
            }
        }
    };

    function draw(ctx, o, x, y, r, t) {
        if (!o._m) {
            const seed = seedOf(o.n);
            o._m = { seed: seed, rnd: d3.randomLcg(seed) };
        }
        ctx.save();
        if (r < 2.5) {
            glow(ctx, x, y, Math.max(2, r * 3), o.c || DOT[o.t] || '#FFFFFF', 0.9);
        } else {
            (DRAW[o.t] || DRAW.estrella)(ctx, o, o._m, x, y, r, t || 0);
        }
        ctx.restore();
    }

    global.IssaAstros = { draw: draw, color: o => o.c || DOT[o.t] || '#FFFFFF' };
})(window);
