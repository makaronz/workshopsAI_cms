# workshopsAI CMS

A comprehensive workshop management system designed for sociologists, built with modern web technologies and accessibility in mind.

## 🎯 Overview

workshopsAI CMS is a specialized content management system that enables sociologists to create and manage workshops in under 10 minutes. The system features an intuitive drag-and-drop interface, comprehensive role-based permissions, and full accessibility compliance.

## ✨ Key Features

- **<10 Minute Workshop Creation**: Rapid template-based workshop publishing
- **Drag & Drop Builder**: Intuitive content organization system
- **Role-Based Access Control**: 5-tier permission system (Participant, Facilitator, Moderator, Sociologist-Editor, Admin)
- **Full Accessibility**: WCAG 2.2 AA compliant interface
- **GDPR Compliant**: Comprehensive data protection and privacy controls
- **Real-time Preview**: See workshops before publishing
- **Multi-language Support**: Polish and English interfaces
- **Responsive Design**: Works seamlessly across all devices

## 📋 Spis treści

- [Funkcjonalności](#funkcjonalności)
- [Technologia](#technologia)
- [Instalacja](#instalacja)
- [Konfiguracja](#konfiguracja)
- [Struktura projektu](#struktura-projektu)
- [API Dokumentacja](#api-dokumentacja)
- [Role i uprawnienia](#role-i-uprawnienia)
- [Przewodnik dla socjologa](#przewodnik-dla-socjologa)
- [Wdrożenie](#wdrożenie)
- [Testowanie](#testowanie)
- [Bezpieczeństwo](#bezpieczeństwo)
- [Wspieranie](#wspieranie)

## 🚀 Funkcjonalności

### Zarządzanie warsztatami
- ✅ Tworzenie i edycja warsztatów z edytorem typu "przeciągnij i upuść"
- ✅ Szablony warsztatów (integracja, konflikty, well-being)
- ✅ Zarządzanie sesjami i modułami
- ✅ System zapisów z listą rezerwową
- ✅ Zarządzanie facylitatorami i lokalizacjami
- ✅ System tagów i kategorii
- ✅ Publikacja i archiwizacja warsztatów

### System użytkowników
- ✅ Autentykacja JWT z rolami
- ✅ 5 poziomów uprawnień (uczestnik, facylitator, moderator, socjolog-redaktor, admin)
- ✅ Profile użytkowników z możliwościami edycji
- ✅ System powiadomień email

### Panel administratora
- ✅ Intuicyjny interfejs dla socjologa-redaktora
- ✅ Szybkie tworzenie warsztatów (<10 minut)
- ✅ Podgląd na żywo przed publikacją
- ✅ Zarządzanie zapisami i uczestnikami
- ✅ Analiza statystyk i raporty

### Bezpieczeństwo i zgodność
- ✅ Ochrona przed atakami XSS, SQL Injection, CSRF
- ✅ Rate limiting i walidacja danych
- ✅ Zgodność z WCAG 2.2 AA
- ✅ Szczegółowe logi i audyt

## 🛠️ Technologia

### Backend
- **Node.js** - Runtime środowiska
- **TypeScript** - Typowanie statyczne
- **Express.js** - Framework webowy
- **Drizzle ORM** - Obsługa bazy danych
- **MySQL** - Baza danych
- **JWT** - Autentykacja
- **Winston** - Logowanie
- **Multer** - Przesyłanie plików

### Frontend
- **Vanilla JavaScript** - Brak frameworków dla szybkości
- **Tailwind CSS** - Stylowanie
- **Web Components** - Modularność
- **Progressive Enhancement** - Dostępność

### Narzędzia deweloperskie
- **ESLint + Prettier** - Jakość kodu
- **Jest** - Testy jednostkowe
- **Drizzle Kit** - Migracje bazy danych
- **Docker** - Konteneryzacja

## 📦 Instalacja

### Wymagania systemowe
- Node.js >= 18.0.0
- npm >= 8.0.0
- MySQL >= 8.0
- Git

### Klonowanie projektu
```bash
git clone <repository-url>
cd workshopsAI_cms
```

### Instalacja zależności
```bash
npm install
```

### Konfiguracja bazy danych
1. Stwórz bazę danych MySQL:
```sql
CREATE DATABASE workshopsai_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Skonfiguruj zmienne środowiskowe (patrz sekcja [Konfiguracja](#konfiguracja))

3. Uruchom migracje:
```bash
npm run db:migrate
```

### Uruchomienie aplikacji
```bash
# Tryb deweloperski
npm run dev

# Tryb produkcyjny
npm run build
npm start
```

## ⚙️ Konfiguracja

### Zmienne środowiskowe
Skopiuj `.env.example` do `.env` i dostosuj ustawienia:

```bash
cp .env.example .env
```

### Kluczowe ustawienia
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - Konfiguracja bazy danych
- `JWT_SECRET` - Sekret JWT (zmień w produkcji!)
- `CORS_ORIGIN` - Domyślne_origin CORS
- `PORT` - Port serwera (domyślnie 3001)

### Konfiguracja bazy danych
W pliku `src/config/database.ts` dostosuj połączenie z bazą danych:
```typescript
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "workshopsai_cms",
};
```

## 📁 Struktura projektu

```
workshopsAI_cms/
├── src/                    # Kod źródłowy
│   ├── config/            # Konfiguracja
│   │   ├── auth.ts         # Autentykacja
│   │   └── database.ts     # Baza danych
│   ├── controllers/        # Kontrolery API
│   ├── middleware/         # Middleware Express
│   ├── models/            # Modele Drizzle ORM
│   │   └── schema.ts       # Definicja schematów
│   ├── routes/            # Trasy API
│   │   ├── workshops.ts   # Endpointy warsztatów
│   │   └── enrollments.ts # Endpointy zapisów
│   ├── services/          # Logika biznesowa
│   │   ├── workshopService.ts
│   │   └── enrollmentService.ts
│   ├── types/             # Definicje typów
│   │   └── validation.ts   # Schematy Zod
│   └── index.ts           # Główny plik serwera
├── public/                # Pliki statyczne
│   ├── css/
│   │   └── main.css       # Główne style
│   ├── js/
│   │   └── main.js        # Główna aplikacja frontend
│   └── index.html         # Szablon HTML
├── tests/                 # Testy
├── docs/                  # Dokumentacja
├── scripts/               # Skrypty pomocnicze
├── .env.example          # Przykład konfiguracji
├── package.json          # Zależności i skrypty
├── tsconfig.json         # Konfiguracja TypeScript
├── README.md             # Ten plik
└── docker-compose.yml    # Konfiguracja Docker
```

## 🔌 API Dokumentacja

### Endpointy warsztatów

#### Lista warsztatów
```http
GET /api/workshops
```

#### Pobierz warsztat po ID
```http
GET /api/workshops/:id
```

#### Utwórz warsztat
```http
POST /api/workshops
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Nowy warsztat",
  "description": "Opis warsztatu",
  "startDate": "2025-01-15T09:00:00Z",
  "endDate": "2025-01-15T17:00:00Z",
  "seatLimit": 20,
  "templateTheme": "integracja",
  "language": "pl"
}
```

#### Aktualizuj warsztat
```http
PUT /api/workshops/:id
Content-Type: application/json
Authorization: Bearer <token>
```

#### Publikuj warsztat
```http
POST /api/workshops/:id/publish
Authorization: Bearer <token>
```

### Endpointy zapisów

#### Lista zapisów
```http
GET /api/enrollments
Authorization: Bearer <token>
```

#### Zapisz na warsztat
```http
POST /api/enrollments
Content-Type: application/json
Authorization: Bearer <token>

{
  "workshopId": "uuid-warsztatu",
  "notes": "Uwagi do zapisu"
}
```

### Pełna dokumentacja API
Dokumentacja jest dostępna pod adresem: `http://localhost:3001/api/docs`

## 👥 Role i uprawnienia

### Uczestnik (participant)
- ✅ Przeglądanie opublikowanych warsztatów
- ✅ Zapisy na warsztaty
- ✅ Zarządzanie swoimi zapisami
- ✅ Wypełnianie ankiet

### Facylitator (facilitator)
- ✅ Wszystkie uprawnienia uczestnika
- ✅ Zarządzanie swoimi warsztatami
- ✅ Potwierdzanie zapisów
- ✅ Śledzenie obecności

### Moderator (moderator)
- ✅ Wszystkie uprawnienia facylitatora
- ✅ Zarządzanie zapisami
- ✅ Moderowanie opinii
- ✅ Podstawowe statystyki

### Socjolog-redaktor (sociologist-editor)
- ✅ Wszystkie uprawnienia moderatora
- ✅ Pełne zarządzanie warsztatami
- ✅ Tworzenie i edycja szablonów
- ✅ Publikacja warsztatów
- ✅ Zarządzanie facylitatorami

### Administrator (admin)
- ✅ Pełne uprawnienia systemowe
- ✅ Zarządzanie użytkownikami
- ✅ Konfiguracja systemu
- ✅ Dostęp do logów i audytu

## 📚 Przewodnik dla socjologa

### Szybkie tworzenie warsztatu (<10 minut)

1. **Zaloguj się** do panelu CMS
2. Kliknij **"Stwórz nowy warsztat"**
3. **Wybierz szablon** (integracja, konflikty, well-being)
4. **Uzupełnij podstawowe dane:**
   - Tytuł warsztatu
   - Data i czas
   - Limit miejsc
   - Facylitator
5. **Dostosuj zawartość:**
   - Przeciągnij moduły w odpowiedniej kolejności
   - Edytuj treść według potrzeb
   - Dodaj lub usuń sesje
6. **Sprawdź podgląd** - kliknij "Podgląd" aby zobaczyć jak wygląda warsztat
7. **Opublikuj** - kliknij "Opublikuj" gdy wszystko jest gotowe

### Porady dla szybkiej pracy

- 🔥 **Korzystaj ze szablonów** - przyspieszają pracę o 80%
- 🔥 **Drag & Drop** - najprostszy sposób na organizację treści
- 🔥 **Podgląd na żywo** - błądów unikniesz
- 🔥 **Zapisz szkic** - nie musisz kończyć na raz
- 🔥 **Duplikuj warsztaty** - dla podobnych tematów

## 🚀 Wdrożenie

### Produkcja

1. **Build aplikacji:**
```bash
npm run build
```

2. **Konfiguracja środowiska:**
```bash
NODE_ENV=production
npm start
```

3. **Nginx (opcjonalnie):**
```nginx
server {
    listen 80;
    server_name twoja-domena.pl;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker
```bash
# Budowanie obrazu
docker build -t workshopsai-cms .

# Uruchomienie z docker-compose
docker-compose up -d
```

## 🧪 Testowanie

### Uruchomienie testów
```bash
# Wszystkie testy
npm test

# Tryb watch
npm run test:watch

# Pokrycie kodu
npm run test:coverage
```

### Typy testów
- **Testy jednostkowe** - Logika serwisów i helperów
- **Testy integracji** - Endpointy API
- **Testy E2E** - Przepływy użytkownika (w planowaniu)

### Testy dostępności
```bash
# Instalacja zależności
npm install -g pa11y

# Testy automatyczne dostępności
pa11y http://localhost:3001
```

## 🔒 Bezpieczeństwo

### Ochrona przed atakami
- ✅ **XSS Protection** - Sanitizacja treści
- ✅ **CSRF Protection** - Tokeny CSRF
- ✅ **SQL Injection** - Drizzle ORM z parametrami
- ✅ **Rate Limiting** - Ograniczenie żądań
- ✅ **Input Validation** - Zod schemas
- ✅ **HTTPS Only** - W produkcji

### Audyt bezpieczeństwa
```bash
# Skan podatności
npm audit

# Semicode
npm run security:scan

# Testy penetracyjne
npm run security:test
```

### Dobre praktyki
- 🔐 **Hasła silne** - Minimum 8 znaków, specjalne znaki
- 🔐 **JWT Secrets** - Długie i losowe klucze
- 🔐 **Env Variables** - Bezpieczne przechowywanie sekretów
- 🔐 **Logi audytu** - Śledzenie operacji

## ♿ Dostępność (WCAG 2.2 AA)

### Implementacja
- ✅ **Nawigacja klawiaturą** - Pełna funkcjonalność bez myszy
- ✅ **Czytniki ekranu** - ARIA labels i role
- ✅ **Kontrast kolorów** - Minimum 4.5:1
- ✅ **Rozmiar tekstu** - Możliwość powiększenia do 200%
- ✅ **Struktura semantyczna** - Prawidłowe nagłówki i listy

### Testy dostępności
```bash
# Axe DevTools
npx axe http://localhost:3001

# Lighthouse
npx lighthouse http://localhost:3001 --view
```

### Porady dla deweloperów
- 🎯 **Używaj semantic HTML** - Zamiast divów
- 🎯 **Dodaj ARIA labels** - Dla formularzy i interakcji
- 🎯 **Testuj z klawiaturą** - Tab i Enter działają
- 🎯 **Sprawdź kontrast** - WebAIM Contrast Checker

## 🤝 Wspieranie

### Dokumentacja
- 📖 **API Documentation** - `/api/docs`
- 📖 **Development Guide** - `/docs/development`
- 📖 **Database Schema** - `/docs/database`

### Pomoc techniczna
- 🐛 **Report Bugs** - GitHub Issues
- 💬 **Discussions** - GitHub Discussions
- 📧 **Email Support** - support@workshopsai.com

### Współpraca
Witamy pull requests i sugestie! Patrz [CONTRIBUTING.md](CONTRIBUTING.md) dla szczegółów.

### Changelog
Zobacz [CHANGELOG.md](CHANGELOG.md) dla historii zmian.

---

** workshopsAI CMS** © 2025. Wszystkie prawa zastrzeżone.

Zbudowane z ❤️ dla społeczności edukacyjnej.