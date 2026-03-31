"""
Dados dos temas padrão do Radar BP e helpers de pontuação.
Centralizado aqui para o router importar sem duplicar constantes.
"""

from __future__ import annotations

TOPICS_DEFAULT: list[dict] = [
    {
        "id": "bolsonaro",
        "tema": "Bolsonaro",
        "categoria": "Política",
        "keywords": ["Bolsonaro", "Jair Bolsonaro"],
        "canais": ["Jovem Pan", "Gazeta do Povo", "Nikolas Ferreira", "Eduardo Bolsonaro"],
        "descricao": "Ex-presidente e maior liderança da direita brasileira.",
        "emoji": "🇧🇷",
        "cor": "#2563eb",
    },
    {
        "id": "lula",
        "tema": "Lula",
        "categoria": "Política",
        "keywords": ["Lula", "governo Lula"],
        "canais": ["GloboNews", "Folha de SP", "PT Partido", "Carta Capital"],
        "descricao": "Governo Lula, PT e políticas do executivo federal.",
        "emoji": "🏛️",
        "cor": "#dc2626",
    },
    {
        "id": "economia",
        "tema": "Economia Brasil",
        "categoria": "Economia",
        "keywords": ["economia brasil", "dólar câmbio"],
        "canais": ["Mises Brasil", "InfoMoney", "Instituto Millenium", "B3"],
        "descricao": "Câmbio, inflação, reforma tributária e mercado financeiro.",
        "emoji": "📊",
        "cor": "#059669",
    },
    {
        "id": "stf",
        "tema": "STF",
        "categoria": "Política",
        "keywords": ["STF supremo", "Alexandre Moraes"],
        "canais": ["Consultor Jurídico", "Jota Info", "Jovem Pan", "Migalhas"],
        "descricao": "Supremo Tribunal Federal, decisões e impacto político-jurídico.",
        "emoji": "⚖️",
        "cor": "#7c3aed",
    },
]

CHANNELS_NATIONAL: list[dict] = [
    {"nome": "Jovem Pan News",  "query": "Jovem Pan",           "flag": "🇧🇷", "foco": "Notícias e Política",    "yt_id": "UCmq_n2-MFRGOU7C6JIzZOIg"},
    {"nome": "Gazeta do Povo",  "query": "Gazeta Povo",         "flag": "🇧🇷", "foco": "Jornalismo Conservador", "yt_id": None},
    {"nome": "MetaPolitica 17", "query": "MetaPolitica Brasil", "flag": "🇧🇷", "foco": "Análise Política",       "yt_id": None},
    {"nome": "Renova Mídia",    "query": "Renova Midia",        "flag": "🇧🇷", "foco": "Mídia Alternativa",      "yt_id": None},
    {"nome": "Senso Incomum",   "query": "Senso Incomum",       "flag": "🇧🇷", "foco": "Direita Liberal",        "yt_id": None},
]

CHANNELS_INTERNATIONAL: list[dict] = [
    {"nome": "PragerU",           "query": "PragerU",           "flag": "🇺🇸", "foco": "Conservadorismo Americano", "yt_id": "UCZWlSUNDvCCS1hBiXV0zKcA"},
    {"nome": "Daily Wire",        "query": "Daily Wire",        "flag": "🇺🇸", "foco": "Mídia Conservadora",        "yt_id": None},
    {"nome": "Tucker Carlson",    "query": "Tucker Carlson",    "flag": "🇺🇸", "foco": "Soberania e Populismo",     "yt_id": "UCkSDhOeXMo2hWhcxnFrJNVQ"},
    {"nome": "Jordan Peterson",   "query": "Jordan B Peterson", "flag": "🇨🇦", "foco": "Psicologia e Valores",      "yt_id": "UCL_f53ZEJxp8TtlOkHwMV9Q"},
    {"nome": "Hillsdale College", "query": "Hillsdale College", "flag": "🇺🇸", "foco": "Educação e Liberdade",      "yt_id": "UCnJ1r9DKBacFCRV5DJSPziA"},
]


def calculate_score(peak_trend: int, n_news: int) -> int:
    """
    Score de oportunidade 0-100.
    Alta tendência + baixa saturação de cobertura = maior score.
    """
    saturation = min(n_news / 15.0, 1.0) * 100
    score = peak_trend * 0.65 + (100 - saturation) * 0.35
    return max(0, min(100, int(score)))


def get_topic_by_id(topic_id: str) -> dict | None:
    return next((t for t in TOPICS_DEFAULT if t["id"] == topic_id), None)
