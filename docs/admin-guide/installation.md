# 📦 Instalacja i Konfiguracja Systemu

**Czas trwania:** 45-90 minut
**Poziom trudności:** ⭐⭐⭐ (Średniozaawansowany)
**Wymagania:** Podstawowa wiedza o serwerach i bazach danych

---

## 🎯 Przegląd instalacyjny

Ten przewodnik przeprowadzi Cię przez kompletną instalację WorkshopsAI CMS w środowisku produkcyjnym. System jest oparty na architekturze nowoczesnych technologii webowych zapewniających bezpieczeństwo, skalowalność i zgodność z RODO.

### 🏗️ Architektura systemu
- **Backend:** Node.js 18+ z TypeScript
- **Baza danych:** PostgreSQL 14+
- **Frontend:** React 18+ z TypeScript
- **Reverse proxy:** Nginx (zalecane)
- **Containerization:** Docker i Docker Compose
- **Monitoring:** Prometheus + Grafana (opcjonalnie)

---

## 🔧 Wymagania systemowe

### 🖥️ Sprzęt minimalny
| Komponent | Minimum | Zalecane |
|-----------|---------|-----------|
| **CPU** | 2 rdzenie | 4+ rdzenie |
| **RAM** | 4 GB | 8+ GB |
| **Storage** | 20 GB SSD | 50+ GB SSD |
| **Network** | 100 Mbps | 1 Gbps |

### 🌐 Oprogramowanie
- **System operacyjny:** Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- **Node.js:** 18.0.0+ (LTS)
- **npm:** 8.0.0+
- **PostgreSQL:** 14.0+
- **Nginx:** 1.18+ (zalecane)
- **Docker:** 20.10+ (opcjonalnie)
- **Git:** 2.25+

---

## 📋 Metody instalacji

Wybierz metodę instalacji odpowiednią dla Twojej organizacji:

### 🐳 **Metoda 1: Docker Compose (Zalecane)**
- ✅ **Zalety:** Szybka instalacja, izolacja środowiska, łatwe backup
- ❌ **Wady:** Wymaga znajomości Dockera
- **Czas:** 20-30 minut

### 🛠️ **Metoda 2: Instalacja manualna**
- ✅ **Zalety:** Pełna kontrola, optymalizacja pod konkretne potrzeby
- ❌ **Wady:** Bardziej skomplikowana, wymaga ręcznej konfiguracji
- **Czas:** 60-90 minut

### ☁️ **Metoda 3: Cloud deployment**
- ✅ **Zalety:** Skalowalność, zarządzanie przez dostawcę
- ❌ **Wady:** Wyższe koszty, mniejsza kontrola
- **Czas:** 15-25 minut

---

## 🐳 Metoda 1: Instalacja przez Docker Compose

### Krok 1: Przygotowanie środowiska

```bash
# Aktualizacja systemu
sudo apt update && sudo apt upgrade -y

# Instalacja Dockera i Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Instalacja Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Krok 2: Klonowanie i konfiguracja projektu

```bash
# Klonowanie repozytorium
git clone https://github.com/workshopsai/workshopsai-cms.git
cd workshopsai-cms

# Kopiowanie plików konfiguracyjnych
cp .env.example .env
cp docker-compose.prod.yml docker-compose.yml
```

### Krok 3: Konfiguracja zmiennych środowiskowych

Edytuj plik `.env`:

```bash
nano .env
```

**Kluczowe ustawienia:**
```env
# Konfiguracja bazy danych
POSTGRES_DB=workshopsai_cms
POSTGRES_USER=workshops_user
POSTGRES_PASSWORD=TWOJE_HASLO_BAZY
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Konfiguracja aplikacji
NODE_ENV=production
PORT=3001
JWT_SECRET=TWOJ_DUGI_I_WYJATKOWY_SEKRET

# Konfiguracja email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=twoj_email@gmail.com
SMTP_PASS=TWOJE_HASLO_EMAIL

# Konfiguracja domeny
DOMAIN=twoja-domena.pl
CORS_ORIGIN=https://twoja-domena.pl

# Konfiguracja storage (opcjonalnie)
AWS_ACCESS_KEY_ID=TWOJ_KLUCZ_AWS
AWS_SECRET_ACCESS_KEY=TWOJ_SEKRET_AWS
AWS_S3_BUCKET=workshopsai-files
AWS_REGION=eu-central-1
```

### Krok 4: Uruchomienie systemu

```bash
# Budowanie i uruchomienie kontenerów
docker-compose up -d

# Sprawdzenie statusu kontenerów
docker-compose ps

# Wyświetlenie logów
docker-compose logs -f
```

### Krok 5: Inicjalizacja bazy danych

```bash
# Uruchomienie migracji
docker-compose exec app npm run db:migrate

# Utworzenie administratora
docker-compose exec app npm run create-admin
```

### Krok 6: Konfiguracja Nginx

Utwórz plik konfiguracyjny Nginx:

```bash
sudo nano /etc/nginx/sites-available/workshopsai-cms
```

```nginx
server {
    listen 80;
    server_name twoja-domena.pl;

    # Przekierowanie na HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name twoja-domena.pl;

    # Konfiguracja SSL
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Proxy do aplikacji backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Pliki statyczne frontend
    location / {
        root /path/to/workshopsai-cms/frontend/dist;
        try_files $uri $uri/ /index.html;

        # Cache headers dla statycznych assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001/health;
        access_log off;
    }
}
```

```bash
# Aktywacja strony
sudo ln -s /etc/nginx/sites-available/workshopsai-cms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🛠️ Metoda 2: Instalacja manualna

### Krok 1: Instalacja Node.js

```bash
# Instalacja Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Weryfikacja instalacji
node --version
npm --version
```

### Krok 2: Instalacja PostgreSQL

```bash
# Instalacja PostgreSQL
sudo apt install postgresql postgresql-contrib

# Konfiguracja użytkownika bazy danych
sudo -u postgres psql
```

```sql
-- Utworzenie użytkownika i bazy danych
CREATE USER workshops_user WITH PASSWORD 'TWOJE_HASLO_BAZY';
CREATE DATABASE workshopsai_cms OWNER workshops_user;
GRANT ALL PRIVILEGES ON DATABASE workshopsai_cms TO workshops_user;
\q
```

### Krok 3: Konfiguracja projektu

```bash
# Klonowanie repozytorium
git clone https://github.com/workshopsai/workshopsai-cms.git
cd workshopsai-cms

# Instalacja zależności backend
npm install

# Instalacja zależności frontend
cd frontend
npm install
cd ..
```

### Krok 4: Konfiguracja zmiennych środowiskowych

```bash
# Kopiowanie i edycja pliku konfiguracyjnego
cp .env.example .env
nano .env
```

```env
# Konfiguracja bazy danych
DB_HOST=localhost
DB_PORT=5432
DB_USER=workshops_user
DB_PASSWORD=TWOJE_HASLO_BAZY
DB_NAME=workshopsai_cms

# Konfiguracja aplikacji
NODE_ENV=production
PORT=3001
JWT_SECRET=TWOJ_DUGI_I_WYJATKOWY_SEKRET

# Inne ustawienia zgodne z metodą Docker
```

### Krok 5: Budowanie aplikacji

```bash
# Budowanie backend
npm run build

# Budowanie frontend
cd frontend
npm run build
cd ..
```

### Krok 6: Migracje bazy danych

```bash
# Generowanie migracji
npm run db:generate

# Uruchomienie migracji
npm run db:migrate
```

### Krok 7: Konfiguracja procesu systemowego

Utwórz plik service dla systemd:

```bash
sudo nano /etc/systemd/system/workshopsai-cms.service
```

```ini
[Unit]
Description=WorkshopsAI CMS
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/workshopsai-cms
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=workshopsai-cms

[Install]
WantedBy=multi-user.target
```

```bash
# Aktywacja i uruchomienie serwisu
sudo systemctl daemon-reload
sudo systemctl enable workshopsai-cms
sudo systemctl start workshopsai-cms

# Sprawdzenie statusu
sudo systemctl status workshopsai-cms
```

---

## 🔒 Konfiguracja bezpieczeństwa

### 1️⃣ Firewall

```bash
# Konfiguracja UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2️⃣ SSL/TLS (Let's Encrypt)

```bash
# Instalacja Certbot
sudo apt install certbot python3-certbot-nginx

# Wygenerowanie certyfikatu
sudo certbot --nginx -d twoja-domena.pl

# Automatyczne odnawianie
sudo crontab -e
# Dodaj: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 3️⃣ Security headers

Dodaj do konfiguracji Nginx:

```nginx
# Additional security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

---

## 🔍 Weryfikacja instalacji

### 1️⃣ Health check endpoint

```bash
# Sprawdzenie statusu aplikacji
curl https://twoja-domena.pl/health
```

Oczekiwany response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "database": "connected",
  "services": {
    "api": "running",
    "database": "connected",
    "storage": "configured"
  }
}
```

### 2️⃣ Test dostępności

```bash
# Test poprawności konfiguracji
curl https://twoja-domena.pl/api/docs
```

### 3️⃣ Logi systemowe

```bash
# Sprawdzenie logów aplikacji
sudo journalctl -u workshopsai-cms -f

# Logi Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 📊 Monitorowanie i logging

### 1️⃣ Konfiguracja logów

Dodaj do `.env`:
```env
# Logging configuration
LOG_LEVEL=info
LOG_FILE_ENABLED=true
LOG_FILE_PATH=/var/log/workshopsai-cms/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
```

### 2️⃣ Monitoring (opcjonalnie)

Instalacja Prometheus i Grafana:

```bash
# Instalacja Prometheus
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v /path/to/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

# Instalacja Grafana
docker run -d \
  --name grafana \
  -p 3000:3000 \
  grafana/grafana
```

---

## 🔄 Proces aktualizacji

### Aktualizacja systemu

```bash
# Dla instalacji Docker
cd /path/to/workshopsai-cms
git pull origin main
docker-compose down
docker-compose up -d --build

# Dla instalacji manualnej
cd /path/to/workshopsai-cms
git pull origin main
npm install
npm run build
sudo systemctl restart workshopsai-cms
```

### Backup przed aktualizacją

```bash
# Backup bazy danych
pg_dump -U workshops_user -h localhost workshopsai_cms > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup plików
tar -czf files_backup_$(date +%Y%m%d_%H%M%S).tar.gz /path/to/uploads
```

---

## 🚨 Rozwiązywanie problemów

### Common issues

**Problem: Błąd połączenia z bazą danych**
```bash
# Sprawdzenie statusu PostgreSQL
sudo systemctl status postgresql

# Test połączenia
psql -U workshops_user -h localhost -d workshopsai_cms
```

**Problem: Brak uprawnień do plików**
```bash
# Ustawienie właściwych uprawnień
sudo chown -R www-data:www-data /path/to/workshopsai-cms
sudo chmod -R 755 /path/to/workshopsai-cms
```

**Problem: Nginx nie działa**
```bash
# Test konfiguracji Nginx
sudo nginx -t

# Sprawdzenie logów
sudo tail -f /var/log/nginx/error.log
```

### Support

- **Documentation:** Pełna dokumentacja techniczna
- **GitHub Issues:** https://github.com/workshopsai/workshopsai-cms/issues
- **Email:** support@workshopsai.com
- **Response time:** 24h business days

---

## ✅ Lista kontrolna po instalacji

- [ ] System uruchomiony i dostępny pod adresem URL
- [ ] Baza danych poprawnie skonfigurowana
- [ ] SSL/TLS certyfikat zainstalowany
- [ ] Użytkownik administratora utworzony
- [ ] Konfiguracja email przetestowana
- [ ] Firewall skonfigurowany
- [ ] Backupy zaplanowane
- [ ] Monitorowanie skonfigurowane
- [ ] Dokumentacja użytkownika dostarczona

---

## 🎉 Gratulacje!

Pomyślnie zainstalowałeś WorkshopsAI CMS! System jest gotowy do użytku i może obsługiwać warsztaty socjologiczne dla Twojej organizacji.

### Następne kroki:
1. [**Zarządzanie użytkownikami**](./user-management.md)
2. [**Konfiguracja bezpieczeństwa**](./security.md)
3. [**Monitorowanie systemu**](./monitoring.md)
4. [**Backup i disaster recovery**](./backup.md)

---

**Pamiętaj:** Regularne aktualizacje i monitoring są kluczowe dla bezpieczeństwa i stabilności systemu!