# Workshop Intelligence - Dokumentacja Projektu

System do zbierania danych od uczestników warsztatów i generowania insightów za pomocą AI.

## 📚 Struktura Dokumentacji

### Dokumenty Główne

1. **[Specyfikacja Techniczna](workshop_participant_system_spec.md)**
   - Pełna specyfikacja systemu
   - Architektura i komponenty
   - Przepływy użytkownika
   - Schemat bazy danych
   - API endpoints
   - Bezpieczeństwo i prywatność

2. **[Plan Implementacji MVP](workshop_intelligence_mvp_plan.md)**
   - Podział na 4 sprinty
   - Szczegółowe zadania z szacunkami czasu
   - Priorytety i zależności
   - Całkowity czas: 98 godzin

3. **[Role i Uprawnienia](workshop_intelligence_roles.md)**
   - Definicje ról: Participant, Facilitator, Admin
   - Macierz uprawnień (30 operacji × 3 role)
   - Przypadki brzegowe
   - Implementacja w kodzie

4. **[Zakres MVP](workshop_intelligence_mvp_scope.md)**
   - Jasny podział: MVP vs Faza 2 vs Faza 3
   - Kryteria akceptacji (funkcjonalne, niefunkcjonalne, biznesowe)
   - Decyzje projektowe
   - Metryki sukcesu

### Pliki Pomocnicze

5. **[Schemat Bazy Danych](workshop_intelligence_schema_updated.ts)**
   - Definicje tabel w Drizzle ORM
   - TypeScript types
   - Relacje między tabelami

## 🎯 Szybki Start

### Dla Programistów

1. Przeczytaj [Specyfikację Techniczną](workshop_participant_system_spec.md) - sekcje 1-4
2. Zapoznaj się z [Planem MVP](workshop_intelligence_mvp_plan.md) - sprawdź aktualny sprint
3. Sprawdź [Schemat Bazy Danych](workshop_intelligence_schema_updated.ts)

### Dla Product Ownerów

1. Przeczytaj [Zakres MVP](workshop_intelligence_mvp_scope.md) - zrozum co wchodzi w MVP
2. Zapoznaj się z [Kryteriami Akceptacji](workshop_intelligence_mvp_scope.md#4-kryteria-akceptacji-mvp)
3. Sprawdź [Metryki Sukcesu](workshop_intelligence_mvp_scope.md#7-metryki-sukcesu-mvp)

### Dla Administratorów

1. Przeczytaj [Role i Uprawnienia](workshop_intelligence_roles.md)
2. Zapoznaj się z [Bezpieczeństwem](workshop_participant_system_spec.md#8-bezpieczeństwo-i-prywatność-uzupełnienie)

## 📊 Status Projektu

| Sprint | Status | Czas | Zakończenie |
|---|---|---|---|
| **Sprint 1: Backend** | ✅ Zakończony | 22h | 30.11.2025 |
| **Sprint 2: Frontend** | ⏳ W trakcie | 25h | - |
| **Sprint 3: LLM** | 📋 Zaplanowany | 28h | - |
| **Sprint 4: Prezentacja** | 📋 Zaplanowany | 23h | - |

## 🔗 Linki

- **Repozytorium:** [makaronz/workshopsAI_cms](https://github.com/makaronz/workshopsAI_cms)
- **Branch:** `manus`
- **Implementacja:** `/src/routes/api/workshop-intelligence.ts`, `/src/services/workshopIntelligenceService.ts`

## 📝 Historia Zmian

### 2025-11-30
- ✅ Sprint 1 zakończony (backend + API)
- ✅ Dodano AnonymizationService (GDPR)
- ✅ Zaktualizowano dokumentację (feedback)
- ✅ Dodano dokumenty: Role, Zakres MVP

### 2025-11-28
- ✅ Utworzono specyfikację techniczną
- ✅ Utworzono plan MVP
- ✅ Przeprowadzono burzę mózgów

## 👥 Autorzy

- **Manus AI** - Projektowanie i implementacja
- **makaronz** - Product Owner

## 📄 Licencja

Projekt wewnętrzny - WorkshopsAI CMS
