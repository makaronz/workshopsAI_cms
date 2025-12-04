# Workshop Intelligence - Deployment Guide

Wszystkie pliki konfiguracyjne są już przygotowane. Wybierz swoją platformę:

---

## 🚀 Option 1: Railway (NAJSZYBSZE - 5 minut)

### Przez Web Dashboard (bez CLI)

1. **Otwórz [railway.app](https://railway.app) i zaloguj się przez GitHub**

2. **Kliknij "New Project" → "Deploy from GitHub repo"**
   - Wybierz repo: `makaronz/workshopsAI_cms`
   - Railway automatycznie wykryje `railway.toml`

3. **Dodaj bazę danych:**
   - Kliknij "+ New" → "Database" → "Add PostgreSQL"
   - Kliknij "+ New" → "Database" → "Add Redis"

4. **Ustaw zmienne środowiskowe:**
   - Przejdź do "Variables"
   - Dodaj: `OPENAI_API_KEY` = `sk-twój-klucz`
   - Railway automatycznie doda: `DATABASE_URL`, `REDIS_URL`

5. **Deploy!**
   - Railway automatycznie:
     - Zbuduje aplikację
     - Uruchomi migracje
     - Wystawi publiczny URL

**URL:** `https://workshopsai-backend.up.railway.app`

### Przez Railway CLI (automatyczne)

```bash
# 1. Zainstaluj CLI
npm install -g @railway/cli

# 2. Zaloguj się
railway login

# 3. Zainicjuj projekt
railway init

# 4. Dodaj bazy danych
railway add --database postgresql
railway add --database redis

# 5. Ustaw API Key
railway variables set OPENAI_API_KEY="sk-twój-klucz"

# 6. Deploy
railway up

# 7. Otwórz w przeglądarce
railway open
```

### Automatyczny deployment z GitHub Actions

Już skonfigurowane! Wystarczy:

```bash
# 1. Zdobądź Railway Token
railway login
railway whoami  # Skopiuj token

# 2. Dodaj do GitHub Secrets
# Settings → Secrets → New repository secret
# Name: RAILWAY_TOKEN
# Value: [twój-token]

# 3. Push do main branch - auto-deployment!
git push origin main
```

---

## 🎨 Option 2: Render (14 DNI DARMOWO)

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

## 🌐 Option 4: Vercel (Frontend) + Railway (Backend)

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

**Backend na Railway** (patrz Option 1)

**Połącz frontend z backendem:**
- W Vercel Dashboard → Settings → Environment Variables
- Dodaj: `VITE_API_URL` = `https://workshopsai-backend.up.railway.app`

---

## ✅ Po Deployment - Checklist

### 1. Sprawdź health endpoint

```bash
curl https://twoja-aplikacja.com/health
# Powinna zwrócić: {"status": "ok"}
```

### 2. Sprawdź migracje bazy danych

```bash
# Railway
railway run psql $DATABASE_URL -c "\dt workshop*"

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

### Railway
```bash
# Logi w czasie rzeczywistym
railway logs

# Metryki
railway status
```

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
| **Railway** | Hobby | Included | Included | **$5** |
| **Render** | Starter | $7 | $7 | **$14** (14 dni FREE) |
| **DigitalOcean** | Basic | Included | Included | **$12** |
| **Vercel + Railway** | Hobby + Hobby | Free + $5 | $0 + $0 | **$5** |
| **VPS (Hetzner)** | CPX11 | Self-hosted | Self-hosted | **€4.15** |

---

## 🆘 Troubleshooting

### "Database connection failed"
```bash
# Sprawdź czy migracje się wykonały
railway run npm run db:migrate
```

### "Redis connection refused"
```bash
# Sprawdź REDIS_URL
railway variables get REDIS_URL
```

### "OpenAI API error"
```bash
# Sprawdź czy klucz jest ustawiony
railway variables get OPENAI_API_KEY
```

### "Build failed"
```bash
# Sprawdź logi
railway logs --tail 100
```

---

## 🎯 Która opcja dla Ciebie?

- **Najszybsza:** Railway (5 minut, $5/mies)
- **Darmowy start:** Render (14 dni free trial)
- **Najlepsza performance:** Vercel + Railway
- **Najtańsza:** Hetzner VPS (€4.15/mies)
- **Enterprise:** DigitalOcean/AWS

---

**Wszystkie konfiguracje są gotowe!** Wystarczy:
1. Wybrać platformę
2. Połączyć GitHub repo
3. Dodać OPENAI_API_KEY
4. Deploy! 🚀
