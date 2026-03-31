# Radar BP Frontend (Next.js + Tailwind)

Interface da equipe de produção para o backend `FastAPI`.

## Requisitos

- Node.js LTS (foi usado `24.x`)
- npm

## Setup

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Frontend: `http://localhost:3000`  
Backend esperado: `http://127.0.0.1:8000`

## Páginas

- `/` Dashboard
- `/topics` Temas + Scores
- `/topics/[topic_id]` Detalhe + briefing
- `/competition` Vídeos + overlap + heatmap
- `/keywords-live` Keywords em monitoramento
- `/seo` SEO Booster
- `/editorial` Editorial IA
- `/login` Login admin (necessário para salvar/exportar briefing e limpar cache)

## Build

```bash
npm run build
```

