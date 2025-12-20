# Plan Wdrożenia (Implementation Roadmap) - workshopsAI_cms

Na podstawie analizy technicznej i rekomendacji z `@fork/`.

## Faza 1: Fundamenty Jakości (Quality Assurance Foundation)
**Cel:** Przywrócenie możliwości testowania aplikacji i zapewnienie podstawowej stabilności.

- [ ] **Zadanie 1.1:** Konfiguracja struktury testów Playwright.
    - Utworzenie katalogów `tests/e2e`, `tests/pages`, `tests/fixtures`.
    - Aktualizacja `playwright.config.ts` (naprawa ścieżek).
    - Wdrożenie `global-setup.ts` dla autentykacji (rekomendacja `fork/`).
- [ ] **Zadanie 1.2:** Implementacja pierwszego testu E2E (Smoke Test).
    - Test logowania (Page Object: `LoginPage`).
    - Test widoczności Dashboardu.
- [ ] **Zadanie 1.3:** Konfiguracja Husky i Lint-staged.
    - Weryfikacja plików `.husky/`.
    - Dodanie hooków `pre-commit` uruchamiających lintowanie i typecheck.

## Faza 2: Backend Refactoring & Cleanup
**Cel:** Uproszczenie `src/index.ts` i poprawa czytelności kodu.

- [ ] **Zadanie 2.1:** Wydzielenie konfiguracji Rate Limiting.
    - Przeniesienie definicji `createRateLimitMiddleware` z `index.ts` do `src/config/rate-limiter.ts`.
- [ ] **Zadanie 2.2:** Modularna inicjalizacja serwera.
    - Stworzenie funkcji `initializeServices()` w osobnym pliku, aby odciążyć `index.ts`.
- [ ] **Zadanie 2.3:** Przegląd zmiennych środowiskowych.
    - Uporządkowanie importów `dotenv` i walidacji `env.ts`.

## Faza 3: CI/CD & DevOps
**Cel:** Automatyzacja procesów wdrażania i testowania.

- [ ] **Zadanie 3.1:** Aktywacja GitHub Actions.
    - Przegląd `.github/workflows/*.disabled`.
    - Włączenie i naprawa workflowu `testing.yml` (uruchamianie Playwright w CI).
- [ ] **Zadanie 3.2:** Weryfikacja Dockerfile.
    - Próbny build i uruchomienie kontenera.

## Faza 4: Frontend Consistency
**Cel:** Ustalenie spójnej architektury frontendowej.

- [ ] **Zadanie 4.1:** Audyt zależności frontendowych.
    - Sprawdzenie czy React jest używany, czy zbędny.
    - Decyzja o usunięciu nieużywanych bibliotek.

## Harmonogram Wstępny
- **Faza 1:** 1-2 dni
- **Faza 2:** 2-3 dni
- **Faza 3:** 1 dzień
- **Faza 4:** 1 dzień
