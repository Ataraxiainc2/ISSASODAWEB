// Idioma de las páginas de ISSASODA: español (Latinoamérica), inglés (EE. UU.) y portugués (Brasil),
// como en las apps. Se carga en el <head>, antes de pintar.
//
// - Orden: ?lang= en la URL, la elección guardada y, si no hay, el idioma del navegador.
// - Texto del HTML: cada traducción es un elemento con class="tr" y lang="es|en|pt"; el CSS de cada página
//   oculta las que no son del idioma activo (sin JavaScript queda el español).
// - Texto de JavaScript: IssaIdioma.t('español', 'English', 'português').
(function (global) {
    'use strict';

    const LANGS = {
        es: { code: 'es-419', label: 'ES', name: 'Español' },
        en: { code: 'en-US', label: 'EN', name: 'English' },
        pt: { code: 'pt-BR', label: 'PT', name: 'Português' }
    };
    const KEY = 'issasoda-idioma';

    function save(lang) {
        try { localStorage.setItem(KEY, lang); } catch (e) { /* sin almacenamiento: solo esta visita */ }
    }

    function detect() {
        const param = new URLSearchParams(location.search).get('lang');
        if (param && LANGS[param]) {
            save(param);
            return param;
        }
        let saved = null;
        try { saved = localStorage.getItem(KEY); } catch (e) { /* sin almacenamiento */ }
        if (saved && LANGS[saved]) return saved;
        const browser = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
        for (const l of browser) {
            const short = String(l).slice(0, 2).toLowerCase();
            if (LANGS[short]) return short;
        }
        return 'en';
    }

    const lang = detect();
    const root = document.documentElement;
    root.lang = LANGS[lang].code;
    root.dataset.lang = lang;

    // Una traducción por idioma; si falta el portugués se usa el inglés
    function t(es, en, pt) {
        if (lang === 'en') return en;
        if (lang === 'pt') return pt != null ? pt : en;
        return es;
    }

    // Lo mismo para objetos { es, en, pt }
    function pick(texts) {
        return texts ? t(texts.es, texts.en, texts.pt) : '';
    }

    // Dirección de esta misma página en otro idioma (conserva el #ancla)
    function urlFor(other) {
        const url = new URL(location.href);
        url.searchParams.set('lang', other);
        return url.pathname + url.search + url.hash;
    }

    // El canonical de cada idioma apunta a sí mismo, para que los buscadores indexen las tres versiones
    function fixCanonical() {
        const link = document.querySelector('link[rel="canonical"]');
        if (!link || !new URLSearchParams(location.search).get('lang')) return;
        const url = new URL(link.href);
        url.searchParams.set('lang', lang);
        link.href = url.href;
    }

    // Selector ES · EN · PT dentro de un contenedor
    function switcher(container) {
        if (!container) return;
        container.textContent = '';
        Object.keys(LANGS).forEach(code => {
            const a = document.createElement('a');
            a.href = urlFor(code);
            a.textContent = LANGS[code].label;
            a.lang = code;
            a.title = LANGS[code].name;
            if (code === lang) a.setAttribute('aria-current', 'true');
            a.addEventListener('click', event => {
                event.preventDefault();
                save(code);
                location.href = urlFor(code);
            });
            container.appendChild(a);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        fixCanonical();
        document.querySelectorAll('[data-idiomas]').forEach(switcher);
        // Título y descripción de la página en el idioma activo
        const title = document.querySelector('title');
        if (title && title.dataset[lang]) title.textContent = title.dataset[lang];
        const meta = document.querySelector('meta[name="description"]');
        if (meta && meta.dataset[lang]) meta.content = meta.dataset[lang];
    });

    global.IssaIdioma = { lang: lang, code: LANGS[lang].code, t: t, pick: pick, urlFor: urlFor, switcher: switcher };
})(window);
