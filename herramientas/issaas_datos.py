"""Genera issaas/datos.json: la evidencia real de ISSA AS que muestra la página issaas/.

Fuente: la carpeta local del repositorio público ISSAAS (solo archivos ya publicados en GitHub):
el reporte de triaje de Muse Spark Open y los paquetes de prueba (veredicto, costo y parche).
El texto de los issues y de los modelos es de terceros: la página lo inserta siempre como texto, nunca como HTML.

Uso:
    python herramientas/issaas_datos.py --issaas "D:/SC/ISSAAS"
"""
import argparse
import datetime
import json
import os

TRIAJE = 'triage-scout-20261102-222258'
CASOS = ['20261102-201027-psobot-keynote-parser-91', '20261102-223630-ansible-ansible-runner-1548']


def leer(ruta):
    with open(ruta, encoding='utf-8') as f:
        return f.read()


def linux(carpeta):
    """Veredicto de la reconstrucción en Linux (GitHub Actions), si existe."""
    ruta = os.path.join(carpeta, 'linux-verify.json')
    if not os.path.exists(ruta):
        return None
    d = json.loads(leer(ruta))
    return {k: d.get(k) for k in ('verdict', 'suite_scope', 'ci_run', 'platform')}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--issaas', default=os.environ.get('ISSAAS_REPO', 'D:/SC/ISSAAS'))
    parser.add_argument('--salida', default=os.path.join(os.path.dirname(__file__), '..', 'issaas', 'datos.json'))
    args = parser.parse_args()

    reporte = json.loads(leer(os.path.join(args.issaas, 'triage', TRIAJE + '.json')))
    seleccion = reporte['selection']
    decision = {s['issue_url']: s['reason'] for s in seleccion.get('skipped', [])}
    elegido = seleccion['picked']
    decision[elegido['issue_url']] = 'picked: ' + elegido['model_rationale']
    triaje = []
    for s in sorted(reporte['scored'], key=lambda s: -s['final_score']):
        triaje.append({
            'repo': s['repo'], 'numero': s['number'], 'url': s['issue_url'], 'titulo': s['title'],
            'clase': s.get('security_class'), 'senales': round(s['signals_score'], 3),
            'spark': s.get('solvability'), 'critico': s.get('solvability_v2'), 'final': round(s['final_score'], 3),
            'real': s.get('is_real_bug'), 'razon': s.get('rationale'), 'decision': decision.get(s['issue_url']),
        })

    casos = []
    for run in CASOS:
        carpeta = os.path.join(args.issaas, 'proof', run)
        veredicto = json.loads(leer(os.path.join(carpeta, 'verdict.json')))
        casos.append({
            'run': run, 'issue': veredicto['issue_id'], 'veredicto': veredicto['verdict'],
            'modelo': veredicto.get('model'), 'esfuerzo': veredicto.get('effort'),
            'costo': veredicto.get('cost_usd'), 'causa': veredicto.get('root_cause'),
            'parche': leer(os.path.join(carpeta, 'fix.patch')),
            'linux': linux(carpeta),
        })

    datos = {
        'generado': datetime.date.today().isoformat(),
        'triaje': {'run': TRIAJE, 'modelo': 'meta-models/muse-spark-open', 'elegido': elegido['issue_url'], 'issues': triaje},
        'casos': casos,
    }
    with open(args.salida, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(datos, f, ensure_ascii=False, separators=(',', ':'))
    print(f"{len(triaje)} issues, {len(casos)} casos -> {args.salida}")


if __name__ == '__main__':
    main()
