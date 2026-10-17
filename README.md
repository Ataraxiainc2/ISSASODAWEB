# ISSASODAWEB

The website of ISSASODA, live at **https://issasodaweb.com**: an explorable universe drawn with D3 that is, at the
same time, a lesson about the universe and a map of ISSASODA itself. In Latin American Spanish, US English and
Brazilian Portuguese.

- **Landing** (`index.html`): a universe you drag and zoom, with smooth zoom journeys between its bodies: the
  ISSASODA sun, the GUAT galaxy (built from `guat/index.json`), the student-progress nebula, the ISSASODA cluster
  (one galaxy per GitHub repository, its catalog features as stars) and the black hole into the scale.
- **Scale of the universe** (`universo/`): 307 objects from the observable universe to the Planck length, each at
  its typical size, with its own drawing and address (`universo/#molecula-de-agua`).
- **About** (`acerca/`): what is implemented and what is pending, as in every ISSASODA app.
- **GUAT** (`guat/`, `Formulas.html`, `Ejercicios/`): the original GUAT University project, kept as a sub-page.

## How it is built

Static HTML, CSS and JavaScript with no build step, published by GitHub Pages (branch `main`, root, with
`.nojekyll`); the custom domain lives in `CNAME` and its DNS on Cloudflare. A service worker (`ServiceWorker.js`)
makes it work offline; bump `CACHE_NAME` whenever its file list changes.

Shared code lives in `comun/`:

- `idioma.js`: language detection (`?lang=`, saved choice, browser) and `IssaIdioma.t(es, en, pt)`. HTML text keeps
  the three versions as `class="tr" lang="es|en|pt"`.
- `estilo.js`: random Google Fonts per visit, readable colors (7:1 contrast) and size formatting.
- `astros.js`: the procedural drawing of every object type of the scale.

## Data

- `universo/objetos.json`: the 307 objects (type, log10 of the size in meters, names in three languages).
- `universo/issasoda.json`: ISSASODA's projects, generated from GitHub and the apps' feature catalogs:

  ```
  python herramientas/issasoda_datos.py --proyectos "<folder with the Android projects>"
  ```

  Private repositories publish only name, description, dates, counts and feature titles: never code, internal
  notes or the repository link.

## Local preview

```
python -m http.server 8080
```

Then open http://localhost:8080. Add `?motion` to see the animations on a system with reduced motion enabled.
