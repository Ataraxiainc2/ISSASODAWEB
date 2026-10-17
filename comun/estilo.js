// Estilo compartido de las páginas de ISSASODA (cargar después de comun/idioma.js): tipografías de Google Fonts al azar en cada visita y colores
// legibles (contraste 7:1 sobre el panel), como en el About de las apps. Necesita d3.
(function (global) {
    'use strict';

    const DISPLAY_FONTS = [
        'Orbitron', 'Audiowide', 'Monoton', 'Bungee', 'Righteous', 'Syncopate',
        'Michroma', 'Rubik Mono One', 'Unica One', 'Megrim', 'Zen Dots', 'Turret Road', 'Chakra Petch',
        'Silkscreen', 'Press Start 2P', 'Bebas Neue', 'Abril Fatface', 'Playfair Display', 'Lobster',
        'Pacifico', 'Cinzel', 'Poiret One', 'Russo One', 'Black Ops One', 'Nova Square', 'Quantico',
        'Gruppo', 'Julius Sans One', 'Wallpoet', 'Krona One', 'Tilt Warp', 'Rubik Glitch', 'Fugaz One',
        'Bungee Shade', 'Dela Gothic One', 'Shrikhand', 'Tourney', 'Big Shoulders Display'
    ];
    const TEXT_FONTS = [
        'Space Grotesk', 'Outfit', 'Manrope', 'Sora', 'Lexend', 'DM Sans', 'Nunito', 'Work Sans',
        'IBM Plex Sans', 'Atkinson Hyperlegible', 'Exo 2', 'Jost', 'Urbanist', 'Red Hat Display',
        'Figtree', 'Comfortaa', 'Quicksand', 'Kanit'
    ];
    const GOLDEN_ANGLE = 137.508;

    function stack(family) {
        return `'${family}', 'Arial', sans-serif`;
    }

    // Una hoja por familia: así la caché del Service Worker guarda cada fuente una sola vez
    function load(family, weights) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=' + family.replace(/ /g, '+') +
            (weights ? ':wght@' + weights : '') + '&display=swap';
        document.head.appendChild(link);
    }

    // n tipografías de títulos distintas y una de texto, ya cargándose
    function fonts(n) {
        const display = d3.shuffle(DISPLAY_FONTS.slice()).slice(0, n);
        const text = TEXT_FONTS[Math.floor(Math.random() * TEXT_FONTS.length)];
        display.forEach(f => load(f));
        load(text, '400;700');
        return { display: display, text: text };
    }

    function luminance(color) {
        const c = d3.rgb(color);
        const lin = v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    }

    function contrast(a, b) {
        const la = luminance(a), lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    // El color más saturado de ese tono que se lee a 7:1 sobre el panel
    function readableColor(hue, panel, ratio) {
        const target = ratio || 7;
        const dark = luminance(panel) < 0.5;
        for (let i = 0; i <= 50; i++) {
            const l = dark ? 0.5 + i * 0.01 : 0.5 - i * 0.01;
            const color = d3.hsl(((hue % 360) + 360) % 360, 0.85, l).formatHex();
            if (contrast(color, panel) >= target) return color;
        }
        return dark ? '#FFFFFF' : '#000000';
    }

    // n colores legibles repartidos por el ángulo áureo a partir de un tono al azar
    function palette(n, panel) {
        const hue = Math.random() * 360;
        return d3.range(n).map(i => readableColor(hue + i * GOLDEN_ANGLE, panel));
    }

    // Tamaños legibles en el idioma activo (comun/idioma.js): años luz, UA, km, m… hasta attómetros
    const lang = (global.IssaIdioma && global.IssaIdioma.lang) || 'es';
    const tr = (es, en, pt) => lang === 'en' ? en : lang === 'pt' ? pt : es;
    const locale = d3.formatLocale(lang === 'en'
        ? { decimal: '.', thousands: ',', grouping: [3], currency: ['$', ''] }
        : { decimal: ',', thousands: lang === 'pt' ? '.' : '\u00a0', grouping: [3], currency: ['', ''] });
    const fmt = v => v >= 100 ? locale.format(',.0f')(v) : locale.format('.2~r')(v);
    const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

    function power(n) {
        return '10' + String(n).split('').map(c => SUP[c] || c).join('');
    }

    function size(log10meters) {
        const m = Math.pow(10, log10meters), LY = 9.4607e15, AU = 1.496e11;
        if (m >= 0.1 * LY) {
            const ly = m / LY;
            if (ly >= 1e9) return fmt(ly / 1e9) + tr(' mil millones de años luz', ' billion light-years', ' bilhões de anos-luz');
            if (ly >= 1e6) return fmt(ly / 1e6) + tr(' millones de años luz', ' million light-years', ' milhões de anos-luz');
            if (ly >= 1e3) return fmt(ly / 1e3) + tr(' mil años luz', ' thousand light-years', ' mil anos-luz');
            return fmt(ly) + tr(' años luz', ' light-years', ' anos-luz');
        }
        if (m >= 0.1 * AU) return fmt(m / AU) + tr(' UA (distancia Tierra–Sol)', ' AU (Earth–Sun distance)', ' UA (distância Terra–Sol)');
        if (m >= 1e3) return fmt(m / 1e3) + ' km';
        if (m >= 1) return fmt(m) + ' m';
        if (m >= 1e-2) return fmt(m * 100) + ' cm';
        if (m >= 1e-3) return fmt(m * 1e3) + ' mm';
        if (m >= 1e-6) return fmt(m * 1e6) + tr(' µm (micras)', ' µm (microns)', ' µm (mícrons)');
        if (m >= 1e-9) return fmt(m * 1e9) + tr(' nm (nanómetros)', ' nm (nanometers)', ' nm (nanômetros)');
        if (m >= 1e-12) return fmt(m * 1e12) + tr(' pm (picómetros)', ' pm (picometers)', ' pm (picômetros)');
        if (m >= 1e-15) return fmt(m * 1e15) + tr(' fm (femtómetros)', ' fm (femtometers)', ' fm (femtômetros)');
        if (m >= 1e-18) return fmt(m * 1e18) + tr(' am (attómetros)', ' am (attometers)', ' am (attômetros)');
        return '≈ ' + power(Math.round(log10meters)) + ' m';
    }

    function number(v) {
        return locale.format(',')(v);
    }

    function scientific(log10meters) {
        const e = Math.floor(log10meters + 1e-9);
        return '≈ ' + locale.format('.2~r')(Math.pow(10, log10meters - e)) + ' × ' + power(e) + ' m';
    }

    // Dirección de un objeto: "Molécula de agua" → "molecula-de-agua"
    function slug(name) {
        return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    global.IssaEstilo = {
        fonts: fonts, stack: stack, contrast: contrast, readableColor: readableColor, palette: palette,
        size: size, scientific: scientific, power: power, slug: slug, number: number
    };
})(window);
