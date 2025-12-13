# Prosta Instalacja WorkshopsAI CMS

## Dla małego zespołu (max 10 użytkowników)

### Krok 1: Przygotowanie

1. **Skopiuj repozytorium**
   ```bash
   git clone <repository-url>
   cd workshopsAI_cms
   git checkout feature/simplify-and-remove-redis
   ```

2. **Skopiuj plik konfiguracyjny**
   ```bash
   cp .env.simple .env
   ```

3. **Zaktualizuj .env**
   - Ustaw `DATABASE_URL` (PostgreSQL)
   - Dodaj klucze API (OpenAI, Claude)
   - Skonfiguruj SMTP (opcjonalnie)

### Krok 2: Instalacja

```bash
npm run setup
```

### Krok 3: Konfiguracja Bazy Danych

```bash
# Uruchom migracje bazy danych
npm run db:migrate
```

### Krok 4: Uruchomienie

**Dewelopment:**
```bash
npm run dev
```

**Produkcja:**
```bash
npm run build
npm start
```

### Krok 5: Docker (opcjonalny)

**Zbuduj obraz:**
```bash
npm run docker:build
```

**Uruchom z Docker:**
```bash
npm run docker:run
```

## Co zostało uproszczone?

✅ **Usunięto Redis** - Zastąpiony prostym cache w pamięci
✅ **Usunięto BullMQ** - Zadania uruchamiane bezpośrednio
✅ **Usunięto rate limiting** - Niepotrzebny dla małego zespołu
✅ **Usunięto CI/CD** - Prosty deployment bez pipeline'ów
✅ **Usunięto złożone security** - Podstawowe zabezpieczenia
✅ **Usunięto Kubernetes** - Prosty deployment na VPS
✅ **Usunięto testy wydajnościowe** - Niepotrzebne dla 10 użytkowników

## Wymagania

- Node.js 20+
- PostgreSQL 12+
- 1 GB RAM minimum
- 5 GB dysku

## Dostępne Endpointy

- **Health Check:** http://localhost:3010/health
- **API:** http://localhost:3010/api
- **Frontend:** http://localhost:3010/

## Support

Aplikacja została uproszczona dla maksymalnie 10 użytkowników. W razie problemów z deploymentem, skontaktuj się z zespołem deweloperskim.