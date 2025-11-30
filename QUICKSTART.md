# Workshop Intelligence - Quick Start Guide 🚀

## Najprostsze metody uruchomienia

### Metoda 1: Docker Compose (ZALECANA) ⚡

Wszystko w jednej komendzie - uruchamia PostgreSQL, Redis, backend i frontend:

```bash
# 1. Skopiuj przykładową konfigurację
cp .env.example .env

# 2. Edytuj .env i dodaj swój OpenAI API Key
nano .env
# Zmień: OPENAI_API_KEY=your-openai-api-key-here
# Na: OPENAI_API_KEY=sk-...twoj-prawdziwy-klucz

# 3. Uruchom wszystko
docker-compose up -d

# 4. Sprawdź logi
docker-compose logs -f app

# 5. Otwórz w przeglądarce
# Backend API: http://localhost:3001
# Nginx: http://localhost
```

**Migracje są uruchamiane automatycznie!** Wszystkie 4 pliki SQL z folderu `migrations/` są wykonywane podczas startu PostgreSQL.

---

### Metoda 2: Lokalne uruchomienie (Development) 💻

Jeśli chcesz modyfikować kod i widzieć zmiany na żywo:

```bash
# 1. Uruchom tylko bazę danych i Redis
docker-compose up -d postgres redis

# 2. Zainstaluj zależności
npm install

# 3. Skopiuj konfigurację
cp .env.example .env
nano .env  # Dodaj OpenAI API Key

# 4. Uruchom migracje
npm run db:migrate
# lub ręcznie:
# psql -h localhost -p 5433 -U workshopsai -d workshopsai_cms -f migrations/0002_workshop_intelligence.sql
# psql -h localhost -p 5433 -U workshopsai -d workshopsai_cms -f migrations/0003_default_prompt_template.sql

# 5. Uruchom backend (terminal 1)
npm run dev

# 6. Uruchom frontend (terminal 2)
cd frontend
npm install
npm run dev

# 7. Otwórz w przeglądarce
# Backend: http://localhost:3001
# Frontend: http://localhost:5173
```

---

## Testowanie Workshop Intelligence

### 1. Logowanie jako Admin

```bash
# Zarejestruj konto
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.pl", "password": "Test1234!", "name": "Admin"}'

# Zaloguj się
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.pl", "password": "Test1234!"}'

# Skopiuj token z odpowiedzi
```

### 2. Użycie komponentów w HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>Workshop Intelligence Test</title>
  <script type="module">
    // Import wszystkich komponentów
    import './frontend/dist/components/workshop-intelligence/index.js';
  </script>
</head>
<body>
  <!-- Admin: Tworzenie formularza -->
  <workshop-form-builder workshop-id="123"></workshop-form-builder>

  <!-- Admin: Toggle blokady -->
  <form-lock-toggle workshop-id="123"></form-lock-toggle>

  <!-- Uczestnik: Wypełnianie formularza -->
  <participant-workshop-form workshop-id="123"></participant-workshop-form>

  <!-- Admin: Zarządzanie analizami -->
  <analysis-viewer workshop-id="123"></analysis-viewer>

  <!-- Uczestnik: Podgląd udostępnionych analiz -->
  <participant-analysis-viewer workshop-id="123"></participant-analysis-viewer>
</body>
</html>
```

### 3. API Endpoints - Przykłady

**Utwórz formularz:**
```bash
curl -X POST http://localhost:3001/api/v1/workshop-intelligence/forms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workshopId": "workshop-uuid"}'
```

**Dodaj pytanie:**
```bash
curl -X POST http://localhost:3001/api/v1/workshop-intelligence/forms/FORM_ID/questions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionText": "Jakie są Twoje oczekiwania wobec tego warsztatu?",
    "questionType": "textarea",
    "isRequired": true,
    "displayOrder": 0
  }'
```

**Uruchom analizę LLM:**
```bash
curl -X POST http://localhost:3001/api/v1/workshop-intelligence/workshops/WORKSHOP_ID/analyses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "gpt-4",
    "customInstructions": "Skup się na potrzebach edukacyjnych uczestników"
  }'
```

**Sprawdź wyniki analizy:**
```bash
curl -X GET http://localhost:3001/api/v1/workshop-intelligence/analyses/ANALYSIS_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Udostępnij analizę uczestnikom:**
```bash
curl -X PUT http://localhost:3001/api/v1/workshop-intelligence/analyses/ANALYSIS_ID/share \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Pełny Workflow

### Scenariusz: Warsztat "Wprowadzenie do AI"

1. **Admin tworzy warsztat i formularz:**
   ```bash
   # POST /api/workshops (stwórz warsztat)
   # POST /api/v1/workshop-intelligence/forms (stwórz formularz)
   ```

2. **Admin dodaje pytania:**
   - "Jakie masz doświadczenie z AI?" (single_choice)
   - "Czego oczekujesz od warsztatu?" (textarea)
   - "Jakie wyzwania chcesz rozwiązać?" (textarea)

3. **5 uczestników wypełnia formularz**
   - Każdy zapisuje swoje odpowiedzi
   - Auto-save po 1 sekundzie
   - Submitują formularz

4. **Admin blokuje formularz:**
   ```bash
   # PUT /api/v1/workshop-intelligence/forms/WORKSHOP_ID/lock
   ```

5. **Admin uruchamia analizę GPT-4:**
   ```bash
   # POST /api/v1/workshop-intelligence/workshops/WORKSHOP_ID/analyses
   # Body: {"modelName": "gpt-4"}
   ```

6. **BullMQ przetwarza w tle (5-30 sekund):**
   - Pobiera wszystkie odpowiedzi
   - Anonimizuje dane (usuwa PII)
   - Wysyła do OpenAI GPT-4
   - Zapisuje wyniki (summary, insights, themes, recommendations, plan)

7. **Admin sprawdza wyniki:**
   - Otwiera Analysis Viewer
   - Widzi szczegółowe insights z priorytetami
   - Widzi recurring themes z przykładami
   - Widzi rekomendacje i plan warsztatu

8. **Admin udostępnia analizę:**
   ```bash
   # PUT /api/v1/workshop-intelligence/analyses/ANALYSIS_ID/share
   ```

9. **Uczestnicy widzą insights:**
   - Participant Analysis Viewer pokazuje pięknie sformatowane wyniki
   - Widzą wspólne tematy i oczekiwania grupy
   - Widzą sugerowany plan warsztatu

---

## Monitoring

### Sprawdzenie statusu serwisów

```bash
# Statusy kontenerów
docker-compose ps

# Logi backendu
docker-compose logs -f app

# Logi PostgreSQL
docker-compose logs -f postgres

# Logi Redis
docker-compose logs -f redis

# Sprawdź czy BullMQ działa
docker-compose exec redis redis-cli
> KEYS *bull*
> exit
```

### Sprawdzenie bazy danych

```bash
# Połącz się z PostgreSQL
docker-compose exec postgres psql -U workshopsai -d workshopsai_cms

# Sprawdź tabele Workshop Intelligence
\dt workshop*

# Sprawdź przykładowe dane
SELECT * FROM workshop_forms LIMIT 5;
SELECT * FROM workshop_llm_analyses;

# Wyjdź
\q
```

---

## Troubleshooting

### Problem: "Connection refused" do Redis

```bash
# Sprawdź czy Redis działa
docker-compose ps redis

# Restart Redis
docker-compose restart redis
```

### Problem: "OpenAI API key not found"

```bash
# Sprawdź .env
cat .env | grep OPENAI

# Edytuj .env
nano .env

# Restart aplikacji
docker-compose restart app
```

### Problem: "Table does not exist"

```bash
# Uruchom migracje ręcznie
docker-compose exec postgres psql -U workshopsai -d workshopsai_cms -f /docker-entrypoint-initdb.d/03_workshop_intelligence.sql
docker-compose exec postgres psql -U workshopsai -d workshopsai_cms -f /docker-entrypoint-initdb.d/04_default_prompt.sql
```

### Problem: Frontend nie ładuje komponentów

```bash
# Build frontend
cd frontend
npm run build

# Sprawdź czy pliki są w dist/
ls -la dist/components/workshop-intelligence/
```

---

## Dostępne Modele LLM

- **gpt-4** - Najbardziej zaawansowany (ZALECANY)
- **gpt-4-turbo** - Szybszy, tańszy
- **gpt-4o** - Zoptymalizowany
- **gpt-4o-mini** - Najtańszy, wystarczający dla prostych analiz
- **claude-3-opus** - Wymaga ANTHROPIC_API_KEY
- **claude-3-sonnet** - Wymaga ANTHROPIC_API_KEY
- **gemini-pro** - Wymaga GOOGLE_AI_API_KEY

---

## Dalsze kroki

1. **Dodaj role-based access control (RBAC)** - TODO w kodzie
2. **Testy E2E** - `npm run test:e2e`
3. **Deployment produkcyjny** - Skonfiguruj SSL w nginx.conf
4. **Monitoring** - `docker-compose --profile monitoring up -d`
5. **Backup bazy** - `docker-compose exec postgres pg_dump -U workshopsai workshopsai_cms > backup.sql`

---

## Struktura projektu Workshop Intelligence

```
/home/user/workshopsAI_cms/
├── migrations/
│   ├── 0002_workshop_intelligence.sql     # Tabele i typy
│   └── 0003_default_prompt_template.sql   # Domyślny prompt
├── src/
│   ├── models/postgresql-schema.ts         # Drizzle schema
│   ├── services/
│   │   ├── workshopIntelligenceService.ts  # Business logic
│   │   ├── llmAnalysisService.ts           # LLM integration
│   │   └── anonymizationService.ts         # PII removal
│   ├── queues/workshopAnalysisQueue.ts     # BullMQ processing
│   └── routes/api/workshop-intelligence.ts # 20 endpoints
└── frontend/src/components/workshop-intelligence/
    ├── form-builder.ts                     # Admin: tworzenie formularzy
    ├── form-lock-toggle.ts                 # Admin: blokada formularzy
    ├── participant-form.ts                 # Uczestnik: wypełnianie
    ├── analysis-viewer.ts                  # Admin: zarządzanie analizami
    └── participant-analysis-viewer.ts      # Uczestnik: podgląd insights
```

**Gotowe do użycia!** 🎉
