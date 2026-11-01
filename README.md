# VERUM RAG · Local Setup

RAG-чат по архитектуре VERUM™ на Gemini API (бесплатный).

## Запуск за 3 шага

**1. Получи бесплатный Gemini API ключ**
Зайди на https://aistudio.google.com → Get API Key → Create API Key
Ключ выглядит так: AIza...

**2. Установи зависимости и создай .env**
```bash
npm install
cp .env.example .env
# Открой .env и вставь свой ключ
```

`.env`:
```
GEMINI_API_KEY=AIza-твой-ключ
PORT=3000
```

**3. Запусти**
```bash
npm start
```

Открыть: **http://localhost:3000**

## Деплой на Railway

1. Запушь репо на GitHub
2. railway.app → New Project → Deploy from GitHub repo
3. Variables → добавь `GEMINI_API_KEY`
4. Settings → Domains → Generate Domain → отправь лиду

## Архитектура безопасности

```
Browser → fetch POST /api/chat   ← ключа нет
    ↓
Express server
    ├── RAG retrieval (TF-scoring, 12 chunks)
    └── Gemini SDK (ключ только в .env на сервере)
```

## API

**POST /api/chat** `{ "query": "Какой API используется?" }`

**GET /api/health** `{ "status": "ok", "model": "gemini-2.0-flash", "chunks": 12 }`
