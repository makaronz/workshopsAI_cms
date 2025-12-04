# Plan Implementacji MVP: System "Workshop Intelligence"

**Wersja:** 1.0  
**Data:** 30 listopada 2025  
**Autor:** Manus AI

## Wprowadzenie

Niniejszy dokument przedstawia szczegółowy, podzielony na zadania plan implementacji dla wersji MVP (Minimum Viable Product) systemu "Workshop Intelligence". Plan ten jest oparty na zaktualizowanej specyfikacji technicznej i uwzględnia wszystkie podjęte decyzje projektowe.

## Cel MVP

Celem MVP jest dostarczenie w pełni funkcjonalnego, choć uproszczonego, systemu, który umożliwi administratorom tworzenie formularzy, zbieranie odpowiedzi od uczestników, uruchamianie analizy LLM i przeglądanie jej wyników. Pozwoli to na szybką weryfikację koncepcji i zebranie feedbacku przed dalszym rozwojem.

## Podział na Sprinty i Zadania

Implementacja MVP została podzielona na cztery tygodniowe sprinty. Każdy sprint koncentruje się na konkretnym obszarze funkcjonalnym.

### Sprint 1: Fundamenty Backendu i Bazy Danych

**Cel:** Stworzenie solidnych podstaw po stronie serwera, które będą wspierać wszystkie przyszłe funkcjonalności.

| Zadanie | Priorytet | Szacowany Czas | Opis Techniczny |
|---|---|---|---|
| **1.1: Migracja Bazy Danych** | **Krytyczny** | 4h | Zdefiniowanie schematów Drizzle ORM dla tabel: `workshop_forms`, `form_questions`, `participant_answers` oraz aktualizacja `llm_analyses`. Wygenerowanie i uruchomienie migracji SQL. |
| **1.2: API do Zarządzania Formularzami** | **Wysoki** | 8h | Implementacja endpointów `POST`, `GET`, `PUT`, `DELETE` dla `/api/workshops/{id}/forms` i `/api/workshops/{id}/forms/questions`. Zapewnienie walidacji danych wejściowych. |
| **1.3: API do Blokowania Edycji** | **Średni** | 4h | Stworzenie endpointów `PUT /api/workshops/{id}/forms/lock` i `unlock`, które będą zmieniać flagę `is_editable` w tabeli `workshop_forms`. |
| **1.4: API do Zapisu Odpowiedzi** | **Wysoki** | 6h | Zaimplementowanie endpointu `POST /api/contributions/{id}/answers`, który będzie zapisywał odpowiedzi uczestników w tabeli `participant_answers`. |

### Sprint 2: Interfejsy Użytkownika (Admin i Uczestnik)

**Cel:** Stworzenie komponentów frontendowych, które umożliwią użytkownikom interakcję z systemem.

| Zadanie | Priorytet | Szacowany Czas | Opis Techniczny |
|---|---|---|---|
| **2.1: Komponent `<form-builder>` (Admin)** | **Wysoki** | 12h | Stworzenie interaktywnego komponentu LitElement, który pozwoli na dodawanie, edytowanie i usuwanie pytań w formularzu. Komponent będzie komunikował się z API z zadania 1.2. |
| **2.2: Przełącznik Blokady (Admin)** | **Średni** | 3h | Dodanie przełącznika w panelu warsztatu, który będzie wywoływał API z zadania 1.3 i wizualnie informował o stanie blokady. |
| **2.3: Komponent `<participant-form>` (Uczestnik)** | **Wysoki** | 10h | Stworzenie komponentu LitElement, który dynamicznie wyrenderuje pytania na podstawie danych z API i umożliwi uczestnikom zapisywanie i przesyłanie odpowiedzi. |

### Sprint 3: Logika Biznesowa, Kolejka Zadań i Integracja z LLM

**Cel:** Zaimplementowanie serca systemu - mechanizmu analizy danych przy użyciu AI.

| Zadanie | Priorytet | Szacowany Czas | Opis Techniczny |
|---|---|---|---|
| **3.1: Konfiguracja Kolejki Zadań** | **Krytyczny** | 6h | Skonfigurowanie BullMQ z Redis do asynchronicznego przetwarzania zadań analizy LLM. Stworzenie workera, który będzie obsługiwał zadania z kolejki. **(Zakończone)** |
| **3.2: Serwis Anonimizacji Danych** | **Krytyczny** | 4h | Implementacja serwisu `AnonymizationService`, który będzie usuwał dane PII z odpowiedzi uczestników przed wysłaniem ich do LLM. **(Zakończone)** |
| **3.3: Serwis Analizy LLM** | **Wysoki** | 8h | Stworzenie serwisu `LLMAnalysisService`, który będzie integrował się z API OpenAI. Serwis będzie wywoływany przez workera z kolejki zadań. **(Zakończone)** |
| **3.4: API Uruchamiania Analizy** | **Krytyczny** | 6h | Zmodyfikowanie endpointu `POST /api/workshops/{id}/analyses`, aby:

1. Zbierał dane.
2. Dodawał zadanie do kolejki BullMQ z zebranymi danymi.
3. Zwracał natychmiastową odpowiedź z ID zadania. **(Zakończone)** |
| **3.5: API Udostępniania Wyników** | **Średni** | 4h | Stworzenie endpointów `PUT /api/analyses/{id}/share` i `hide`, które będą zmieniać flagę `is_visible_to_participants` w tabeli `workshop_llm_analyses`. **(Zakończone)** |

### Sprint 4: Prezentacja Wyników i Finalizacja

**Cel:** Udostępnienie wyników analizy użytkownikom i przygotowanie MVP do wdrożenia.

| Zadanie | Priorytet | Szacowany Czas | Opis Techniczny |
|---|---|---|---|
| **4.1: Komponent `<analysis-viewer>` (Admin)** | **Wysoki** | 10h | Stworzenie komponentu LitElement, który w przejrzysty sposób wyświetli wyniki analizy (podsumowanie, wnioski, rekomendacje). Komponent będzie zawierał przycisk do udostępniania wyników. |
| **4.2: Widok Wyników (Uczestnik)** | **Średni** | 5h | Stworzenie uproszczonego widoku wyników, który będzie renderowany w panelu warsztatu tylko wtedy, gdy analiza została udostępniona. |
| **4.3: Testy End-to-End i Poprawki** | **Krytyczny** | 8h | Przeprowadzenie pełnych testów manualnych całego przepływu: od stworzenia formularza, przez wypełnienie go przez uczestnika, po uruchomienie analizy i wyświetlenie wyników. Poprawki błędów. |

## Podsumowanie Planu MVP

| Sprint | Główne Cele | Szacowany Czas |
|---|---|---|
| **Sprint 1** | Fundamenty Backendu | 22h |
| **Sprint 2** | Interfejsy Użytkownika | 25h |
| **Sprint 3** | Integracja z LLM i Kolejka | 28h |
| **Sprint 4** | Prezentacja Wyników | 23h |
| **RAZEM** | **Pełne MVP** | **98h** |

Po zakończeniu tych czterech sprintów, system "Workshop Intelligence" będzie gotowy do pierwszego wdrożenia i testów z prawdziwymi użytkownikami.
