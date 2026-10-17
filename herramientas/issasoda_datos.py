"""Genera universo/issasoda.json: los proyectos de ISSASODA como astros del universo de la web.

Fuentes: GitHub (cuenta Ataraxiainc2, con `gh` autenticado) y los catálogos de funciones de cada app
(`docs/features/catalog.tsv`) en la carpeta local de proyectos.

Privacidad: de los repositorios privados solo se publican nombre, descripción, fechas, conteos y los títulos
de sus funciones; nunca código, notas internas ni el enlace al repositorio.

Uso:
    python herramientas/issasoda_datos.py --proyectos "<carpeta de proyectos Android>"
    (o la variable de entorno ISSASODA_PROYECTOS)
"""
import argparse
import csv
import datetime
import json
import os
import re
import subprocess
import sys

CUENTA = 'Ataraxiainc2'

# Descripciones en los tres idiomas de la web (español de Latinoamérica, inglés de EE. UU., portugués de Brasil)
PROYECTOS = [
    {
        'repo': 'GUAT', 'nombre': 'GUAT', 'tipo': 'web', 'color': '#A99BFF',
        'sitio': 'https://issasodaweb.com/guat/', 'carpeta': None,
        'desc': {
            'es': 'Proyecto universitario GUAT: árbol de estudiantes, cursos y clases con lecturas, podcasts y fórmulas. Es también el código de esta web.',
            'en': 'GUAT university project: a tree of students, courses and classes with readings, podcasts and formulas. It is also the code of this website.',
            'pt': 'Projeto universitário GUAT: árvore de estudantes, cursos e aulas com leituras, podcasts e fórmulas. É também o código deste site.',
        },
    },
    {
        'repo': 'EmuGaMind', 'nombre': 'EmuGaMind', 'tipo': 'app', 'color': '#FF6B9A',
        'sitio': 'https://emugamind.issasodaweb.com', 'carpeta': 'EmuGaMind',
        'desc': {
            'es': 'Plataforma Android donde el tiempo de juego se gana respondiendo preguntas académicas: el juego avanza mientras el jugador responde.',
            'en': 'Android platform where playing time is earned by answering academic questions: the game runs while the player keeps answering.',
            'pt': 'Plataforma Android em que o tempo de jogo se ganha respondendo perguntas acadêmicas: o jogo segue enquanto o jogador responde.',
        },
    },
    {
        'repo': 'ISSASTUDENT', 'nombre': 'ISSASTUDENT', 'tipo': 'app', 'color': '#3EE6B0',
        'sitio': 'https://issastudent.web.app', 'carpeta': 'ISSASTUDENT',
        'desc': {
            'es': 'App Android de estudio para exámenes de admisión a la universidad, sin juegos ni interrupciones y con seguimiento del progreso. Comparte el banco de preguntas con EmuGaMind.',
            'en': 'Android study app for university entrance exams, with no games or interruptions and with progress tracking. It shares its question bank with EmuGaMind.',
            'pt': 'App Android de estudo para vestibulares, sem jogos nem interrupções e com acompanhamento do progresso. Compartilha o banco de perguntas com o EmuGaMind.',
        },
    },
    {
        'repo': 'BookCompass', 'nombre': 'BookCompass', 'tipo': 'app', 'color': '#FFB36B',
        'sitio': 'https://bookcompass.web.app', 'carpeta': 'BookCompass',
        'desc': {
            'es': 'App Android que recomienda un libro a la vez según el perfil y el historial del lector.',
            'en': "Android app that recommends one book at a time based on the reader's profile and history.",
            'pt': 'App Android que recomenda um livro por vez com base no perfil e no histórico do leitor.',
        },
    },
    {
        'repo': 'ISSASPEAKER', 'nombre': 'ISSASPEAKER', 'tipo': 'app', 'color': '#7FD1FF',
        'sitio': 'https://ataraxiainc2.github.io/ISSASPEAKER/', 'carpeta': 'ISSASPEAKER',
        'desc': {
            'es': 'Centro de mando personal para Android: une el altavoz Google Home, Google Workspace, la música y modelos de IA con tus propias claves, con la seguridad primero.',
            'en': 'Personal command center for Android: it joins the Google Home speaker, Google Workspace, music and AI models on your own keys, security first.',
            'pt': 'Central de comando pessoal para Android: une o alto-falante Google Home, o Google Workspace, a música e modelos de IA com suas próprias chaves, com a segurança em primeiro lugar.',
        },
    },
    {
        'repo': 'MovieRecommendationApp', 'nombre': 'MovieRecommendationApp', 'tipo': 'app', 'color': '#FF5F7E',
        'sitio': None, 'carpeta': 'MovieRecommendationApp',
        'desc': {
            'es': 'Recomendaciones de películas con tu propia IA: aprende lo que ves y te gusta, verifica cada título con TMDB y muestra una película a la vez.',
            'en': 'Movie recommendations from your own AI: it learns what you watch and like, checks every title against TMDB and shows one movie at a time.',
            'pt': 'Recomendações de filmes com a sua própria IA: aprende o que você assiste e gosta, confere cada título no TMDB e mostra um filme por vez.',
        },
    },
    {
        'repo': 'ISSAGRAPPH', 'nombre': 'ISSAGRAPPH', 'tipo': 'app', 'color': '#9CCC65',
        'sitio': None, 'carpeta': 'ISSAGRAPPH',
        'desc': {
            'es': 'App Android para practicar matemáticas con gráficas: currículo guiado, banco de ejercicios, fórmulas, laboratorio y un tutor de IA.',
            'en': 'Android app to practice math with graphs: a guided curriculum, an exercise bank, formulas, a lab and an AI tutor.',
            'pt': 'App Android para praticar matemática com gráficos: currículo guiado, banco de exercícios, fórmulas, laboratório e um tutor de IA.',
        },
    },
    {
        'repo': 'ISSAA_I', 'nombre': 'ISSAA I', 'tipo': 'app', 'color': '#CE93D8',
        'sitio': None, 'carpeta': 'ISSAA_I',
        'desc': {
            'es': 'App Android que sigue el mercado de modelos de IA con fuentes abiertas y los evalúa con acertijos generados en tres idiomas.',
            'en': 'Android app that follows the AI model market from open sources and evaluates models with puzzles generated in three languages.',
            'pt': 'App Android que acompanha o mercado de modelos de IA com fontes abertas e os avalia com enigmas gerados em três idiomas.',
        },
    },
    {
        'repo': 'FrontierAI-Safety', 'nombre': 'FrontierAI-Safety', 'tipo': 'investigacion', 'color': '#FFD54F',
        'sitio': None, 'carpeta': None,
        'desc': {
            'es': 'Marco para evaluar la seguridad, los dilemas éticos y el mal uso adversario de los modelos de IA de frontera.',
            'en': 'A framework for evaluating safety, ethical dilemmas and adversarial misuse in frontier AI models.',
            'pt': 'Uma estrutura para avaliar a segurança, os dilemas éticos e o uso adversarial de modelos de IA de fronteira.',
        },
    },
    {
        'repo': 'latex2text-ES', 'nombre': 'latex2text-ES', 'tipo': 'herramienta', 'color': '#80DEEA',
        'sitio': None, 'carpeta': None,
        'desc': {
            'es': 'Herramienta de código abierto que convierte expresiones LaTeX en texto en español para leer y compartir fórmulas matemáticas.',
            'en': 'Open-source tool that turns LaTeX expressions into Spanish text so that math formulas can be read aloud and shared.',
            'pt': 'Ferramenta de código aberto que converte expressões LaTeX em texto em espanhol para ler e compartilhar fórmulas matemáticas.',
        },
    },
    {
        'repo': 'C-H-N', 'nombre': 'C-H-N', 'tipo': 'herramienta', 'color': '#B0BEC5',
        'sitio': None, 'carpeta': None,
        'desc': {
            'es': 'Calculadora de la calidad del software.',
            'en': 'Software quality calculator.',
            'pt': 'Calculadora da qualidade de software.',
        },
    },
]

ESTADOS = {'implemented': 'h', 'validate': 'v', 'planned': 'p', 'blocked': 'b'}


def gh(*args):
    return subprocess.run(['gh', *args], capture_output=True, text=True, encoding='utf-8', check=True).stdout


def commits(repo):
    salida = subprocess.run(['gh', 'api', '-i', f'repos/{CUENTA}/{repo}/commits?per_page=1'],
                            capture_output=True, text=True, encoding='utf-8').stdout
    enlace = next((l for l in salida.splitlines() if l.lower().startswith('link:')), '')
    m = re.search(r'page=(\d+)>; rel="last"', enlace)
    return int(m.group(1)) if m else (1 if '"sha"' in salida else 0)


def catalogo(carpeta_proyectos, carpeta):
    if not carpeta_proyectos or not carpeta:
        return None
    ruta = os.path.join(carpeta_proyectos, carpeta, 'docs', 'features', 'catalog.tsv')
    if not os.path.exists(ruta):
        return None
    funciones = []
    with open(ruta, encoding='utf-8', newline='') as f:
        for fila in csv.DictReader(f, delimiter='\t'):
            estado = ESTADOS.get((fila.get('status') or '').strip())
            if not estado:
                continue
            # Solo estado y títulos: las notas internas no se publican
            titulo = [estado, (fila.get('title_es') or '').strip(), (fila.get('title_en') or '').strip()]
            pt = (fila.get('title_pt') or '').strip()
            if pt:
                titulo.append(pt)
            funciones.append(titulo)
    return funciones


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--proyectos', default=os.environ.get('ISSASODA_PROYECTOS'))
    parser.add_argument('--salida', default=os.path.join(os.path.dirname(__file__), '..', 'universo', 'issasoda.json'))
    args = parser.parse_args()

    repos = {r['name']: r for r in json.loads(gh('repo', 'list', CUENTA, '--limit', '200', '--json',
                                                   'name,visibility,primaryLanguage,createdAt,pushedAt'))}
    faltan = sorted(set(repos) - {p['repo'] for p in PROYECTOS})
    if faltan:
        sys.exit(f'Repositorios sin descripción en PROYECTOS: {faltan}')

    proyectos = []
    for p in PROYECTOS:
        r = repos[p['repo']]
        publico = r['visibility'] == 'PUBLIC'
        funciones = catalogo(args.proyectos, p['carpeta'])
        proyectos.append({
            'id': re.sub(r'[^a-z0-9]+', '-', p['nombre'].lower()).strip('-'),
            'nombre': p['nombre'],
            'tipo': p['tipo'],
            'color': p['color'],
            'publico': publico,
            'lenguaje': (r.get('primaryLanguage') or {}).get('name'),
            'creado': r['createdAt'][:10],
            'actualizado': r['pushedAt'][:10],
            'commits': commits(p['repo']),
            'repo': f'https://github.com/{CUENTA}/{p["repo"]}' if publico else None,
            'sitio': p['sitio'],
            'desc': p['desc'],
            'funciones': funciones,
        })

    conteo = {k: 0 for k in 'hvpb'}
    for p in proyectos:
        for f in p['funciones'] or []:
            conteo[f[0]] += 1
    datos = {
        'generado': datetime.date.today().isoformat(),
        'cuenta': CUENTA,
        'totales': {
            'proyectos': len(proyectos),
            'publicos': sum(p['publico'] for p in proyectos),
            'commits': sum(p['commits'] for p in proyectos),
            'funciones': conteo,
            'conCatalogo': sum(1 for p in proyectos if p['funciones'] is not None),
        },
        'proyectos': proyectos,
    }
    with open(args.salida, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(datos, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print(json.dumps(datos['totales'], ensure_ascii=False))


if __name__ == '__main__':
    main()
