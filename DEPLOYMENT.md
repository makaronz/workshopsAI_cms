# Workshop Intelligence - Deployment Guide

Wszystkie pliki konfiguracyjne są już przygotowane. Wybierz swoją platformę:

> **📋 Ranking alternatyw:** Zobacz [docs/deployment-alternatives-ranking.md](docs/deployment-alternatives-ranking.md) dla szczegółowego porównania platform.

---

## 🥇 Option 1: DigitalOcean App Platform (REKOMENDOWANE)

### Najlepsza równowaga cena/funkcje/łatwość

**Dlaczego DigitalOcean App Platform?**
- ✅ Przewidywalne koszty od $5/miesiąc (app) + $15/mies (PostgreSQL) + $15/mies (Redis) = **$35/miesiąc**
- ✅ Managed PostgreSQL i Redis wbudowane
- ✅ Pełne wsparcie full-stack (Node.js, TypeScript)
- ✅ Automatyczne skalowanie
- ✅ Global CDN + DDoS protection
- ✅ Darmowy tier: 3 statyczne strony

### Przez Web Dashboard (Najłatwiejsze)

1. **Otwórz [DigitalOcean App Platform](https://cloud.digitalocean.com/apps) i zaloguj się**

2. **Kliknij "Create App" → "GitHub"**
   - Wybierz repo: `makaronz/workshopsAI_cms`
   - Wybierz branch: `main`
   - Włącz **Autodeploy** (automatyczny deployment przy każdym push)
   - Kliknij **Next**

3. **Skonfiguruj Web Service:**
   - DigitalOcean automatycznie wykryje Node.js z `package.json`
   - **Build Command:** `npm install && npm run build` (już wykryte)
   - **Run Command:** `npm start` (już wykryte)
   - **HTTP Port:** `3010` (lub zostaw domyślne)
   - **Instance Size:** `Basic XXS` ($5/mies) - dla startu
   - **Health Check Path:** `/health`
   - Kliknij **Next**

4. **Dodaj bazy danych:**
   - Kliknij **"Add Resource"** → **"Database"** → **"PostgreSQL"**
     - **Name:** `db`
     - **Database Name:** `workshopsai_cms`
     - **User:** `workshopsai`
     - **Plan:** `Basic` ($15/mies) - dla startu
     - Kliknij **Create and Attach**
   
   - Kliknij **"Add Resource"** → **"Database"** → **"Redis"**
     - **Name:** `redis`
     - **Plan:** `Basic` ($15/mies) - dla startu
     - Kliknij **Create and Attach**
   
   - Kliknij **Next**

5. **Ustaw zmienne środowiskowe:**
   - Przejdź do sekcji **Environment Variables**
   - DigitalOcean automatycznie doda:
     - `DATABASE_URL` = `${db.DATABASE_URL}` (z PostgreSQL)
     - `REDIS_URL` = `${redis.REDIS_URL}` (z Redis)
   
   - **Dodaj ręcznie:**
     - `NODE_ENV` = `production`
     - `OPENAI_API_KEY` = `sk-twój-klucz` (ustaw jako **SECRET**)
     - `JWT_SECRET` = `[wygeneruj: openssl rand -hex 32]` (ustaw jako **SECRET**)
     - `REFRESH_TOKEN_SECRET` = `[wygeneruj: openssl rand -hex 32]` (ustaw jako **SECRET**)
     - `SESSION_SECRET` = `[wygeneruj: openssl rand -hex 32]` (ustaw jako **SECRET**)
     - `JWT_EXPIRES_IN` = `7d`
     - `REFRESH_TOKEN_EXPIRES_IN` = `30d`
     - `CORS_ORIGIN` = `*` (zmień później na swoją domenę)
     - `LOG_LEVEL` = `info`
   
   - Kliknij **Next**

6. **Ustawienia aplikacji:**
   - **App Name:** `workshopsai-cms`
   - **Region:** `Frankfurt (FRA)` - najbliżej Polski
   - Kliknij **Next**

7. **Review i Deploy:**
   - Sprawdź konfigurację i koszty
   - Kliknij **Create Resources**

8. **Po deployment:**
   - DigitalOcean automatycznie:
     - Zbuduje aplikację
     - Uruchomi migracje (jeśli skonfigurowane)
     - Wystawi publiczny URL z HTTPS
   
   - **Uruchom migracje ręcznie:**
     - Przejdź do **Settings** → **Console**
     - Uruchom: `npm run db:migrate`

**URL:** `https://workshopsai-cms-xxxxx.ondigitalocean.app`

### Przez DigitalOcean CLI (Zaawansowane)

```bash
# 1. Zainstaluj CLI
brew install doctl  # macOS
# lub dla Linux:
curl -sL https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz | tar -xzv
sudo mv doctl /usr/local/bin

# 2. Zaloguj się
doctl auth init
# Wprowadź token z: https://cloud.digitalocean.com/account/api/tokens

# 3. Deploy używając app.yaml
doctl apps create --spec app.yaml

# 4. Sprawdź status
doctl apps list
doctl apps get <app-id>

# 5. Zobacz logi
doctl apps logs <app-id> --type run
```

### Używając app.yaml (Zalecane)

Plik `app.yaml` jest już przygotowany w repozytorium. Możesz go użyć na dwa sposoby:

**Opcja A: Przez Dashboard**
1. Otwórz [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Kliknij **"Create App"** → **"From App Spec"**
3. Wklej zawartość `app.yaml` lub załaduj plik
4. Ustaw environment variables (OPENAI_API_KEY, JWT_SECRET, etc.)
5. Kliknij **Create Resources**

**Opcja B: Przez CLI**
```bash
doctl apps create --spec app.yaml
```

### Po Deployment - Migracje bazy danych

DigitalOcean nie uruchamia automatycznie migracji. Musisz to zrobić ręcznie:

**Metoda 1: Przez Console (Dashboard)**
1. Przejdź do **Settings** → **Console**
2. Uruchom: `npm run db:migrate`

**Metoda 2: Przez CLI**
```bash
doctl apps run <app-id> --command "npm run db:migrate"
```

**Metoda 3: Przez Job (Zalecane dla produkcji)**
Dodaj job do `app.yaml`:
```yaml
jobs:
  - name: db-migrate
    github:
      repo: makaronz/workshopsAI_cms
      branch: main
    source_dir: /
    run_command: npm run db:migrate
    environment_slug: node-js
    instance_size_slug: basic-xxs
    kind: PRE_DEPLOY  # Uruchomi przed deploymentem
    envs:
      - key: DATABASE_URL
        value: ${db.DATABASE_URL}
        scope: RUN_TIME
        type: SECRET
```

### Koszty miesięczne

| Komponent | Plan | Koszt |
|-----------|------|-------|
| Web Service | Basic XXS | $5 |
| PostgreSQL | Basic | $15 |
| Redis | Basic | $15 |
| **TOTAL** | | **$35/miesiąc** |

> **💡 Tip:** Możesz zacząć od mniejszych planów i skalować w górę w miarę potrzeb.

---

## 🥈 Option 2: Render (NAJŁATWIEJSZA MIGRACJA)

### 14 dni darmowego tieru

### Przez Web Dashboard

1. **Otwórz [render.com](https://render.com) i zaloguj się przez GitHub**

2. **Kliknij "New +" → "Blueprint"**
   - Wybierz repo: `makaronz/workshopsAI_cms`
   - Render automatycznie wykryje `render.yaml`
   - Kliknij "Apply"

3. **Render automatycznie utworzy:**
   - ✅ Web Service (backend)
   - ✅ PostgreSQL Database
   - ✅ Redis Instance

4. **Ustaw OPENAI_API_KEY:**
   - Przejdź do utworzonego Web Service
   - Environment → Add Environment Variable
   - Key: `OPENAI_API_KEY`
   - Value: `sk-twój-klucz`

5. **Gotowe!** Render automatycznie:
   - Zbuduje aplikację
   - Uruchomi migracje
   - Wystawi HTTPS URL

**URL:** `https://workshopsai-backend.onrender.com`

### Automatyczny deployment z GitHub

Już skonfigurowane! Każdy push do `main` automatycznie triggeruje deployment.

---

## 🐳 Option 3: Docker (VPS/Cloud)

### DigitalOcean App Platform (click & deploy)

1. **Połącz z GitHub:**
   - Otwórz [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
   - "Create App" → "GitHub"
   - Wybierz repo `makaronz/workshopsAI_cms`

2. **Wykryje automatycznie:**
   - Dockerfile.production
   - Dodaje PostgreSQL i Redis

3. **Ustaw env variables:**
   - `OPENAI_API_KEY`

**Koszt:** $12/mies (Basic Plan)

### Własny VPS (Hetzner/DigitalOcean)

```bash
# 1. SSH do serwera
ssh root@twoj-serwer-ip

# 2. Sklonuj repo
git clone https://github.com/makaronz/workshopsAI_cms.git
cd workshopsAI_cms

# 3. Skopiuj .env
cp .env.example .env
nano .env  # Dodaj OPENAI_API_KEY i inne

# 4. Build i uruchom produkcyjny Docker
docker build -f Dockerfile.production -t workshopsai .
docker-compose up -d

# 5. (Opcjonalne) Nginx + SSL
apt install nginx certbot -y
certbot --nginx -d twoja-domena.com
```

---

## 🌐 Option 4: Vercel (Frontend) + DigitalOcean/Render (Backend)

### Najlepsza performance - CDN + Edge

**Frontend na Vercel:**

```bash
cd frontend

# 1. Zainstaluj Vercel CLI
npm install -g vercel

# 2. Deploy
vercel --prod

# Vercel automatycznie:
# - Buduje frontend
# - Hostuje na globalnym CDN
# - Generuje URL: https://workshopsai.vercel.app
```

**Backend na DigitalOcean App Platform lub Render** (patrz Option 1 lub 2)

**Połącz frontend z backendem:**
- W Vercel Dashboard → Settings → Environment Variables
- Dodaj: `VITE_API_URL` = `https://twoja-aplikacja-backend.com`

---

## ✅ Po Deployment - Checklist

### 1. Sprawdź health endpoint

```bash
curl https://twoja-aplikacja.com/health
# Powinna zwrócić: {"status": "ok"}
```

### 2. Sprawdź migracje bazy danych

```bash
# DigitalOcean App Platform
# Dashboard → Database → Connect → psql $DATABASE_URL -c "\dt workshop*"

# Render
# Dashboard → Shell → psql $DATABASE_URL -c "\dt workshop*"

# Powinny być 7 tabel Workshop Intelligence
```

### 3. Test API

```bash
# Sprawdź prompt templates
curl https://twoja-aplikacja.com/api/v1/workshop-intelligence/prompt-templates

# Powinien zwrócić default template
```

### 4. Zarejestruj pierwszego użytkownika

```bash
curl -X POST https://twoja-aplikacja.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123!",
    "name": "Admin"
  }'
```

### 5. Test kompletnego workflow

```bash
# 1. Login
TOKEN=$(curl -X POST https://twoja-aplikacja.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "SecurePass123!"}' \
  | jq -r '.token')

# 2. Utwórz formularz
FORM=$(curl -X POST https://twoja-aplikacja.com/api/v1/workshop-intelligence/forms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workshopId": "test-123"}' | jq -r '.id')

# 3. Uruchom analizę (po dodaniu pytań i odpowiedzi)
curl -X POST https://twoja-aplikacja.com/api/v1/workshop-intelligence/workshops/test-123/analyses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"modelName": "gpt-4"}'
```

---

## 📊 Monitoring

### DigitalOcean App Platform
- Dashboard → Logs (live stream)
- Dashboard → Metrics (CPU, Memory, Requests, Response Times)
- Integracja z zewnętrznymi systemami przez log forwarding

### Render
- Dashboard → Logs (live stream)
- Dashboard → Metrics (CPU, Memory, Requests)

### Health Checks

Wszystkie platformy mają skonfigurowane health checks:
- Endpoint: `/health`
- Interval: 30s
- Timeout: 10s

---

## 🔒 Bezpieczeństwo

### Przed produkcją zmień:

1. **JWT_SECRET** - minimum 32 znaki
   ```bash
   openssl rand -hex 32
   ```

2. **DB_PASSWORD** - silne hasło
   ```bash
   openssl rand -base64 24
   ```

3. **CORS_ORIGIN** - ustaw na swoją domenę
   ```
   CORS_ORIGIN=https://twoja-domena.com
   ```

4. **Rate Limiting** - już skonfigurowane w Express

---

## 💰 Koszty miesięczne

| Platforma | Plan | PostgreSQL | Redis | Total |
|-----------|------|-----------|-------|-------|
| **DigitalOcean App Platform** | Basic | $15 | $15 | **$35** (lub $5 + databases) |
| **Render** | Starter | $7 | $7 | **$14** (14 dni FREE) |
| **Fly.io** | Usage-based | Variable | Variable | **Variable** |
| **Vercel + DO/Render** | Free + Paid | Free + $15 | $0 + $15 | **$30+** |
| **VPS (DigitalOcean)** | Basic | Self-hosted | Self-hosted | **$4-12** |

> **💡 Tip:** Zobacz [docs/deployment-alternatives-ranking.md](docs/deployment-alternatives-ranking.md) dla szczegółowego porównania kosztów.

---

## 🆘 Troubleshooting

### "Database connection failed"
```bash
# Sprawdź czy migracje się wykonały
# DigitalOcean: Dashboard → App → Deployments → Run Command → npm run db:migrate
# Render: Dashboard → Shell → npm run db:migrate
```

### "Redis connection refused"
```bash
# Sprawdź REDIS_URL w environment variables
# DigitalOcean: Dashboard → App → Settings → Environment Variables
# Render: Dashboard → Environment → Environment Variables
```

### "OpenAI API error"
```bash
# Sprawdź czy klucz jest ustawiony w environment variables
# DigitalOcean: Dashboard → App → Settings → Environment Variables
# Render: Dashboard → Environment → Environment Variables
```

### "Build failed"
```bash
# Sprawdź logi w dashboard
# DigitalOcean: Dashboard → App → Deployments → View Logs
# Render: Dashboard → Logs
```

---

## 🎯 Która opcja dla Ciebie?

- **Najlepsza równowaga:** DigitalOcean App Platform ($5/mies start, przewidywalne koszty)
- **Najłatwiejsza migracja:** Render (14 dni free trial, bardzo podobne do Railway - łatwa migracja)
- **Najlepsza performance:** Vercel + DigitalOcean/Render (CDN + Edge)
- **Najtańsza:** VPS (DigitalOcean Droplets $4/mies, ale wymaga więcej pracy)
- **Globalna dystrybucja:** Fly.io (edge computing)

> **📋 Szczegółowy ranking:** Zobacz [docs/deployment-alternatives-ranking.md](docs/deployment-alternatives-ranking.md)

---

**Wszystkie konfiguracje są gotowe!** Wystarczy:
1. Wybrać platformę
2. Połączyć GitHub repo
3. Dodać OPENAI_API_KEY
4. Deploy! 🚀
