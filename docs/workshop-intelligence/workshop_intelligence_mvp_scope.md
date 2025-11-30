# Workshop Intelligence: Zakres MVP vs Przyszłe Fazy

**Wersja:** 1.0  
**Data:** 30 listopada 2025  
**Autor:** Manus AI

## 1. Wprowadzenie

Niniejszy dokument precyzyjnie definiuje, które funkcjonalności są częścią MVP (Minimum Viable Product), a które zostaną zaimplementowane w przyszłych fazach rozwoju. Dokument powstał w odpowiedzi na feedback dotyczący konieczności jasnego określenia zakresu MVP.

## 2. Definicja MVP

**MVP (Minimum Viable Product)** to minimalna wersja produktu, która:
- Dostarcza **kluczową wartość** dla użytkowników końcowych
- Pozwala na **weryfikację koncepcji** i zebranie feedbacku
- Może być **wdrożona i przetestowana** w realnych warunkach
- **Nie zawiera** wszystkich planowanych funkcjonalności

**Cel MVP:** Umożliwienie facylitatorom zbierania danych od uczestników warsztatów i generowania podstawowych insightów za pomocą AI w ciągu 4 tygodni pracy.

## 3. Zakres MVP (Faza 1)

### 3.1. ✅ Funkcjonalności WCHODZĄCE w MVP

| Funkcjonalność | Priorytet | Uzasadnienie |
|---|---|---|
| **Tworzenie formularzy z dynamicznymi pytaniami** | **Krytyczny** | Podstawa systemu - bez tego nie ma zbierania danych |
| **Typy pytań: text, textarea, multiple_choice, single_choice** | **Wysoki** | Pokrywa 80% potrzeb typowych warsztatów |
| **Wypełnianie formularzy przez uczestników** | **Krytyczny** | Kluczowa funkcjonalność dla uczestników |
| **Edycja własnych odpowiedzi** | **Wysoki** | Pozwala uczestnikom poprawiać błędy |
| **Ręczne blokowanie/odblokowywanie formularzy** | **Wysoki** | Daje facylitatorowi kontrolę nad deadline'em |
| **Anonimizacja danych przed wysłaniem do LLM** | **Krytyczny** | Wymóg GDPR i bezpieczeństwa |
| **Integracja z jednym modelem LLM (GPT-4o-mini)** | **Krytyczny** | Podstawowa analiza AI |
| **Predefiniowany szablon promptu** | **Wysoki** | Upraszcza uruchomienie analizy |
| **Asynchroniczne przetwarzanie analiz (BullMQ)** | **Krytyczny** | Zapewnia responsywność UI |
| **Generowanie podstawowych wyników: podsumowanie, insights, rekomendacje** | **Krytyczny** | Kluczowa wartość dla facylitatora |
| **Udostępnianie wyników uczestnikom (opcjonalne)** | **Wysoki** | Zwiększa zaangażowanie uczestników |
| **Historia analiz** | **Średni** | Pozwala porównać wyniki różnych analiz |
| **Podstawowy interfejs administratora (form builder)** | **Krytyczny** | Umożliwia tworzenie formularzy |
| **Podstawowy interfejs uczestnika (formularz)** | **Krytyczny** | Umożliwia wypełnianie formularzy |
| **Podstawowy widok wyników** | **Krytyczny** | Umożliwia przeglądanie analiz |

### 3.2. ❌ Funkcjonalności NIE WCHODZĄCE w MVP (Faza 2+)

| Funkcjonalność | Faza | Uzasadnienie przesunięcia |
|---|---|---|
| **Dodatkowe typy pytań (rating, yes_no, file upload)** | **Faza 2** | Nice-to-have, nie krytyczne dla MVP |
| **Wielomodelowość LLM (Claude, Gemini)** | **Faza 2** | GPT-4o-mini wystarcza do weryfikacji koncepcji |
| **Niestandardowe szablony promptów (edytor)** | **Faza 2** | Predefiniowany prompt wystarcza na start |
| **Eksport wyników do PDF/Word** | **Faza 2** | Użytkownicy mogą kopiować tekst w MVP |
| **Wizualizacje danych (wykresy, dashboardy)** | **Faza 2** | Tekstowe wyniki są wystarczające |
| **Formularz krok-po-kroku (wizard)** | **Faza 2** | Prosty formularz jest łatwiejszy do zaimplementowania |
| **Automatyczny deadline (timer)** | **Faza 2** | Ręczne blokowanie jest prostsze |
| **Powiadomienia e-mail (przypomnienia, wyniki)** | **Faza 2** | Nie krytyczne dla podstawowej funkcjonalności |
| **Analiza sentymentu** | **Faza 3** | Zaawansowana funkcja AI |
| **Chmury tagów i zaawansowane wizualizacje** | **Faza 3** | Zaawansowana funkcja wizualizacji |
| **Integracja z kalendarzem** | **Faza 3** | Nice-to-have, nie core functionality |
| **Mobilna aplikacja** | **Faza 3** | Responsive web wystarcza na start |

## 4. Kryteria Akceptacji MVP

MVP zostanie uznane za ukończone, gdy spełni następujące kryteria:

### 4.1. Kryteria Funkcjonalne

| Kryterium | Opis | Sposób weryfikacji |
|---|---|---|
| **F1: Tworzenie formularza** | Admin może utworzyć formularz z minimum 3 pytaniami różnych typów | Test manualny |
| **F2: Wypełnianie formularza** | Uczestnik może wypełnić formularz i zapisać odpowiedzi | Test manualny |
| **F3: Edycja odpowiedzi** | Uczestnik może edytować swoje odpowiedzi przed zablokowaniem | Test manualny |
| **F4: Blokowanie formularza** | Admin może zablokować formularz, po czym uczestnicy nie mogą edytować | Test manualny |
| **F5: Uruchamianie analizy** | Admin może uruchomić analizę i otrzymać wyniki w ciągu 2 minut | Test manualny + monitoring |
| **F6: Anonimizacja** | Wyniki analizy nie zawierają danych PII (e-maile, imiona) | Test automatyczny + przegląd |
| **F7: Udostępnianie wyników** | Admin może udostępnić wyniki uczestnikom | Test manualny |
| **F8: Historia analiz** | Admin widzi listę wszystkich przeprowadzonych analiz | Test manualny |

### 4.2. Kryteria Niefunkcjonalne

| Kryterium | Wartość docelowa | Sposób pomiaru |
|---|---|---|
| **NF1: Czas odpowiedzi API** | < 500ms dla 95% żądań | Monitoring APM |
| **NF2: Czas analizy LLM** | < 2 minuty dla 20 uczestników | Monitoring kolejki |
| **NF3: Dostępność** | > 99% uptime | Monitoring serwera |
| **NF4: Bezpieczeństwo** | 0 krytycznych luk bezpieczeństwa | Pen-test + audyt kodu |
| **NF5: Użyteczność (UX)** | > 80% użytkowników kończy formularz | Analytics |
| **NF6: Zgodność z GDPR** | 100% danych PII zanonimizowanych | Audyt danych |

### 4.3. Kryteria Biznesowe

| Kryterium | Wartość docelowa | Sposób pomiaru |
|---|---|---|
| **B1: Koszt analizy** | < $0.01 per uczestnik | Monitoring kosztów API |
| **B2: Czas implementacji** | < 100 godzin pracy | Tracking czasu |
| **B3: Feedback użytkowników** | > 4/5 ocena użyteczności | Ankieta po testach |

## 5. Plan Rozwoju po MVP

### Faza 2: Rozszerzenie Funkcjonalności (Miesiąc 2)

**Cel:** Zwiększenie elastyczności i użyteczności systemu na podstawie feedbacku z MVP.

**Kluczowe funkcjonalności:**
- Wielomodelowość LLM (Claude, Gemini)
- Edytor szablonów promptów
- Eksport wyników do PDF/Word
- Dodatkowe typy pytań (rating, yes_no)
- Podstawowe wizualizacje (wykresy słupkowe)

**Szacowany czas:** 60-80 godzin

### Faza 3: Zaawansowane Funkcje (Miesiąc 3)

**Cel:** Dodanie zaawansowanych funkcji analitycznych i automatyzacji.

**Kluczowe funkcjonalności:**
- Analiza sentymentu
- Chmury tagów i zaawansowane wizualizacje
- Automatyczne deadline'y z timerem
- Powiadomienia e-mail
- Integracja z kalendarzem

**Szacowany czas:** 80-100 godzin

### Faza 4: Optymalizacja i Skalowalność (Miesiąc 4)

**Cel:** Przygotowanie systemu do obsługi większej liczby użytkowników.

**Kluczowe funkcjonalności:**
- Optymalizacja wydajności
- Caching wyników analiz
- Batch processing dla wielu warsztatów
- Mobilna responsywność
- A/B testing różnych promptów

**Szacowany czas:** 60-80 godzin

## 6. Decyzje Projektowe dla MVP

### 6.1. Uproszczenia Techniczne

Dla przyspieszenia dostarczenia MVP, podejmujemy następujące decyzje:

1. **Jeden model LLM:** Tylko GPT-4o-mini (najniższy koszt, wystarczająca jakość)
2. **Predefiniowany prompt:** Jeden, przetestowany szablon promptu
3. **Prosty formularz:** Bez wizarda, wszystkie pytania na jednej stronie
4. **Tekstowe wyniki:** Bez wykresów i wizualizacji
5. **Kopiowanie zamiast eksportu:** Użytkownicy mogą kopiować wyniki do schowka

### 6.2. Uproszczenia UX

1. **Brak onboardingu:** Zakładamy, że użytkownicy są zaznajomieni z CMS
2. **Minimalna walidacja:** Podstawowa walidacja formularzy (required fields)
3. **Brak tooltipów:** Proste interfejsy bez rozbudowanych podpowiedzi
4. **Brak undo/redo:** Użytkownicy mogą edytować, ale nie cofać zmian

## 7. Metryki Sukcesu MVP

Po wdrożeniu MVP, będziemy mierzyć sukces na podstawie:

| Metryka | Cel | Sposób pomiaru |
|---|---|---|
| **Adopcja** | > 10 warsztatów używa systemu w pierwszym miesiącu | Analytics |
| **Completion Rate** | > 80% uczestników kończy formularz | Analytics |
| **Satisfaction** | > 4/5 ocena od facylitatorów | Ankieta NPS |
| **Time to Value** | < 30 minut od utworzenia formularza do pierwszej analizy | Monitoring |
| **Cost per Analysis** | < $0.20 per warsztat (20 uczestników) | Monitoring kosztów |

## 8. Podsumowanie

MVP systemu "Workshop Intelligence" koncentruje się na dostarczeniu **kluczowej wartości** - zbieraniu danych od uczestników i generowaniu insightów przez AI - w najprostszy możliwy sposób. Wszystkie zaawansowane funkcje zostały świadomie przesunięte do przyszłych faz, aby umożliwić szybkie wdrożenie i zebranie feedbacku.

**Zasada MVP:** "Zrób najprostszą rzecz, która może zadziałać, a potem iteruj na podstawie feedbacku."
