_content of the brainstorming document to create the technical specification._

I will now start creating the detailed technical specification document based on our brainstorming session. This will formalize the system architecture, user flows, database schema, and implementation roadmap. I will share the final document with you once it is complete.

I will start by appending the introduction and system overview to the `workshop_participant_system_spec.md` file.

```markdown
# Specyfikacja Techniczna: System "Workshop Intelligence"

**Wersja:** 1.1  
**Data:** 30 listopada 2025  
**Autor:** Manus AI

## 1. Wprowadzenie

Niniejszy dokument stanowi szczegółową specyfikację techniczną dla nowego modułu w systemie WorkshopsAI CMS, nazwanego **"Workshop Intelligence"**. Celem tego modułu jest zrewolucjonizowanie procesu przygotowywania warsztatów poprzez zautomatyzowane zbieranie i analizę danych od uczestników przy użyciu modeli językowych (LLM).

System umożliwi uczestnikom warsztatów anonimowe dzielenie się swoimi pomysłami, oczekiwaniami i wyzwaniami przed rozpoczęciem warsztatu. Następnie, administrator lub facylitator będzie mógł za pomocą jednego kliknięcia uruchomić zaawansowaną analizę AI, która przetworzy zebrane dane i wygeneruje kompleksowe podsumowanie, kluczowe wnioski, rekomendacje oraz sugerowany plan warsztatu.

## 2. Cele Systemu

Główne cele biznesowe i operacyjne systemu "Workshop Intelligence" są następujące:

*   **Zwiększenie Efektywności Warsztatów:** Dostarczenie facylitatorom głębokich wglądów w potrzeby i oczekiwania uczestników, co pozwoli na lepsze dopasowanie treści i struktury warsztatu.
*   **Oszczędność Czasu:** Zautomatyzowanie procesu zbierania i analizy danych, co znacząco skróci czas potrzebny na przygotowanie warsztatu.
*   **Poprawa Zaangażowania Uczestników:** Włączenie uczestników w proces projektowania warsztatu, co zwiększy ich zaangażowanie i poczucie wpływu.
*   **Prywatność i Bezpieczeństwo:** Zapewnienie pełnej anonimowości i prywatności uczestnikom, co zachęci do szczerych i otwartych odpowiedzi.
*   **Skalowalność:** Stworzenie elastycznego systemu, który będzie można łatwo dostosowywać do różnych typów warsztatów i grup uczestników.
```
_content of the brainstorming document to create the technical specification._

I will now start creating the detailed technical specification document based on our brainstorming session. This will formalize the system architecture, user flows, database schema, and implementation roadmap. I will share the final document with you once it is complete.

I will start by appending the introduction and system overview to the `workshop_participant_system_spec.md` file.

```markdown
## 2. Finalized Decisions & Refinements

Based on user feedback, the following key decisions have been made, refining the system's requirements:

*   **Dynamic & Editable Forms:** Workshop administrators will have the ability to create and edit custom forms for each workshop. This includes defining the questions, their types (e.g., text, multiple choice), and other properties. This moves away from a static form structure.

*   **Manual Contribution Locking:** Administrators will have a manual control (e.g., a toggle switch) in the workshop dashboard to lock or unlock the ability for participants to submit or edit their contributions. This provides flexible deadline management.

*   **Controlled Visibility of Results:** While analysis results are primarily for the administrator/facilitator, an option will be available to make a specific analysis report visible to all workshop participants. This is a per-analysis setting controlled by the admin.

*   **Multiple Analyses & History:** The system will support running multiple analyses for the same workshop, storing each result set. This allows for iterating on prompts or analyzing data at different stages.

These decisions will be reflected in the updated database schema and implementation plan below.
```
_content of the brainstorming document to create the technical specification._

I will now start creating the detailed technical specification document based on our brainstorming session. This will formalize the system architecture, user flows, database schema, and implementation roadmap. I will share the final document with you once it is complete.

I will start by appending the introduction and system overview to the `workshop_participant_system_spec.md` file.

```markdown
## 3. Architektura Systemu

System "Workshop Intelligence" zostanie zbudowany w oparciu o istniejącą architekturę aplikacji WorkshopsAI CMS, rozszerzając ją o nowe komponenty. Poniższy diagram przedstawia ogólną architekturę systemu.

```
┌─────────────────────────────────────────────────────────────┐
│                    WORKSHOP PARTICIPANT SYSTEM               │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   PARTICIPANT    │         │      ADMIN       │         │   LLM ENGINE     │
│   INTERFACE      │         │    DASHBOARD     │         │                  │
│                  │         │                  │         │                  │
│ - Login          │         │ - Workshop List  │         │ - GPT-4          │
│ - View My Data   │         │ - Trigger LLM    │         │ - Claude         │
│ - Submit Input   │         │ - View Results   │         │ - Gemini         │
│ - Edit Input     │         │ - Export Data    │         │ - Custom Models  │
└────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
         │                            │                            │
         │                            │                            │
         └────────────────────────────┼────────────────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │   DATABASE LAYER       │
                         │                        │
                         │ - participant_inputs   │
                         │ - llm_analyses         │
                         │ - analysis_results     │
                         │ - prompt_templates     │
                         └────────────────────────┘
```

### 3.1. Główne Komponenty

| Komponent | Opis | Technologia |
|---|---|---|
| **Interfejs Uczestnika** | Umożliwia uczestnikom logowanie, wypełnianie formularzy i przeglądanie swoich danych. | LitElement, TypeScript |
| **Panel Administratora** | Pozwala administratorom zarządzać warsztatami, uruchamiać analizy LLM i przeglądać wyniki. | LitElement, TypeScript |
| **Silnik LLM** | Odpowiada za przetwarzanie danych i generowanie analiz. Będzie integrował się z zewnętrznymi dostawcami modeli językowych. | Node.js, TypeScript, OpenAI SDK, Anthropic SDK, Google AI SDK |
| **Warstwa Bazy Danych** | Przechowuje dane o warsztatach, uczestnikach, ich wkładach, analizach LLM i wynikach. | PostgreSQL, Drizzle ORM |
| **System Kolejkowy** | (Opcjonalnie, w Fazie 2) Zarządza długotrwałymi zadaniami analizy LLM, aby uniknąć blokowania interfejsu użytkownika. | BullMQ lub Redis Queue |
| **Serwis Eksportu** | (Opcjonalnie, w Fazie 2) Umożliwia eksport wyników analizy do formatów PDF i Word. | Node.js, Puppeteer, Docx |

```
_content of the brainstorming document to create the technical specification._

I will now start creating the detailed technical specification document based on our brainstorming session. This will formalize the system architecture, user flows, database schema, and implementation roadmap. I will share the final document with you once it is complete.

I will start by appending the introduction and system overview to the `workshop_participant_system_spec.md` file.

```markdown
## 4. Przepływy Użytkownika (User Flows)

### 4.1. Przepływ 1: Uczestnik Wypełnia Formularz

1.  **Inicjacja:** Uczestnik otrzymuje unikalny link do formularza (np. `/workshops/{workshop_id}/contribute`).
2.  **Logowanie:** Uczestnik loguje się do systemu, aby uzyskać dostęp do formularza.
3.  **Wypełnianie Danych:** Uczestnik wypełnia formularz, odpowiadając na pytania zdefiniowane przez administratora.
4.  **Zapisywanie:** Uczestnik może zapisać wersję roboczą swoich odpowiedzi lub przesłać je ostatecznie.
5.  **Edycja:** Uczestnik może edytować swoje odpowiedzi do momentu ręcznego zablokowania przez administratora.

### 4.2. Przepływ 2: Administrator Zarządza Formularzem i Analizą

1.  **Tworzenie Formularza:** Administrator w panelu warsztatu tworzy niestandardowy formularz, dodając i edytując pytania.
2.  **Zarządzanie Dostępem:** Administrator może w dowolnym momencie zablokować lub odblokować możliwość edycji odpowiedzi przez uczestników.
3.  **Uruchomienie Analizy:** Administrator wybiera model LLM, szablon promptu i uruchamia analizę.
4.  **Udostępnianie Wyników:** Po wygenerowaniu analizy, administrator ma opcję udostępnienia jej uczestnikom.

### 4.3. Przepływ 3: Przeglądanie Wyników Analizy

1.  **Dostęp (Admin):** Administrator przegląda wyniki w swoim panelu.
2.  **Dostęp (Uczestnik):** Jeśli administrator udostępnił analizę, uczestnicy mogą ją przeglądać w panelu warsztatu.
3.  **Historia:** Administrator ma dostęp do historii wszystkich przeprowadzonych analiz.
```
_content of the brainstorming document to create the technical specification._

I will now start creating the detailed technical specification document based on our brainstorming session. This will formalize the system architecture, user flows, database schema, and implementation roadmap. I will share the final document with you once it is complete.

I will start by appending the introduction and system overview to the `workshop_participant_system_spec.md` file.

```markdown
## 5. Zaktualizowany Schemat Bazy Danych

W odpowiedzi na nowe wymagania, schemat bazy danych został rozszerzony o tabele do zarządzania dynamicznymi formularzami.

### 5.1. Tabela: `workshop_forms`

Definiuje strukturę formularza dla konkretnego warsztatu.

```sql
CREATE TABLE workshop_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  is_editable BOOLEAN NOT NULL DEFAULT true, -- Kontrolowane przez admina
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  
  UNIQUE(workshop_id)
);
```

### 5.2. Tabela: `form_questions`

Przechowuje poszczególne pytania w ramach formularza.

```sql
CREATE TABLE form_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES workshop_forms(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(50) NOT NULL, -- np. 'text', 'textarea', 'multiple_choice', 'single_choice'
  options JSONB, -- dla typów multiple_choice/single_choice
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### 5.3. Tabela: `participant_answers`

Przechowuje odpowiedzi uczestników na poszczególne pytania.

```sql
CREATE TABLE participant_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID NOT NULL REFERENCES participant_contributions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES form_questions(id) ON DELETE CASCADE,
  answer_data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  
  UNIQUE(contribution_id, question_id)
);
```

### 5.4. Tabela: `llm_analyses` (zaktualizowana)

Dodano pole `is_visible_to_participants`.

```sql
CREATE TABLE llm_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  triggered_by UUID NOT NULL REFERENCES users(id),
  model_name VARCHAR(100) NOT NULL,
  prompt_template_id UUID REFERENCES prompt_templates(id),
  custom_instructions TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  is_visible_to_participants BOOLEAN NOT NULL DEFAULT false, -- Nowe pole
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```
```
_content of the brainstorming document to create the technical specification._

I will now start creating the detailed technical specification document based on our brainstorming session. This will formalize the system architecture, user flows, database schema, and implementation roadmap. I will share the final document with you once it is complete.

I will start by appending the introduction and system overview to the `workshop_participant_system_spec.md` file.

```markdown
## 6. Zaktualizowane API Endpoints

### 6.1. Form Management

*   **`POST /api/workshops/{workshopId}/forms`**
    *   **Opis:** Tworzy formularz dla warsztatu.
*   **`PUT /api/workshops/{workshopId}/forms`**
    *   **Opis:** Aktualizuje formularz (np. dodaje/usuwa pytania).
*   **`PUT /api/workshops/{workshopId}/forms/lock`**
    *   **Opis:** Blokuje możliwość edycji odpowiedzi.
*   **`PUT /api/workshops/{workshopId}/forms/unlock`**
    *   **Opis:** Odblokowuje możliwość edycji odpowiedzi.

### 6.2. LLM Analysis (zaktualizowane)

*   **`PUT /api/analyses/{analysisId}/share`**
    *   **Opis:** Udostępnia analizę uczestnikom.
*   **`PUT /api/analyses/{analysisId}/hide`**
    *   **Opis:** Ukrywa analizę przed uczestnikami.
```
_content of the brainstorming document to create the technical specification._

I will now start creating the detailed technical specification document based on our brainstorming session. This will formalize the system architecture, user flows, database schema, and implementation roadmap. I will share the final document with you once it is complete.

I will start by appending the introduction and system overview to the `workshop_participant_system_spec.md` file.

```markdown
## 7. Szczegółowy Plan Implementacji MVP

Implementacja MVP (Minimum Viable Product) zostanie podzielona na cztery sprinty, koncentrując się na dostarczeniu kluczowych funkcjonalności w sposób iteracyjny.

### Sprint 1: Backend - Baza Danych i Zarządzanie Formularzami

**Cel:** Przygotowanie fundamentów backendu, umożliwiających tworzenie i zarządzanie formularzami.

| Zadanie | Opis |
|---|---|
| **1.1: Schemat Bazy Danych** | Zaimplementowanie nowych tabel (`workshop_forms`, `form_questions`, `participant_answers`) i aktualizacja istniejących (`llm_analyses`) przy użyciu Drizzle ORM. Stworzenie i uruchomienie migracji. |
| **1.2: API do Zarządzania Formularzami** | Stworzenie endpointów API (CRUD) do tworzenia, odczytu, aktualizacji i usuwania formularzy oraz ich pytań. |
| **1.3: API do Blokowania Formularzy** | Implementacja endpointów do blokowania i odblokowywania możliwości edycji odpowiedzi przez uczestników. |
| **1.4: API do Zapisu Odpowiedzi** | Stworzenie endpointu, który pozwoli uczestnikom zapisywać swoje odpowiedzi na pytania w formularzu. |

### Sprint 2: Frontend - Interfejsy Admina i Uczestnika

**Cel:** Stworzenie interfejsów użytkownika, które umożliwią interakcję z backendem.

| Zadanie | Opis |
|---|---|
| **2.1: UI Budowniczego Formularzy (Admin)** | Stworzenie komponentu LitElement `<form-builder>`, który pozwoli administratorom na dynamiczne tworzenie i edytowanie pytań w formularzu. |
| **2.2: UI Blokowania Formularzy (Admin)** | Dodanie przełącznika w panelu administratora, który będzie komunikował się z API do blokowania/odblokowywania formularzy. |
| **2.3: UI Formularza Uczestnika** | Stworzenie komponentu LitElement `<participant-form>`, który dynamicznie wyrenderuje formularz na podstawie jego struktury i umożliwi uczestnikom przesyłanie odpowiedzi. |

### Sprint 3: Backend - Integracja z LLM i Analiza

**Cel:** Zaimplementowanie logiki biznesowej odpowiedzialnej za analizę danych przy użyciu modeli językowych.

| Zadanie | Opis |
|---|---|
| **3.1: Serwis Analizy LLM** | Stworzenie serwisu `LLMAnalysisService`, który będzie integrował się z API OpenAI (dla MVP model `gpt-4o-mini`) i zawierał predefiniowany szablon promptu. |
| **3.2: API Uruchamiania Analizy** | Stworzenie endpointu, który zbierze wszystkie odpowiedzi uczestników, zanonimizuje je, sformatuje w prompt i wyśle do `LLMAnalysisService`, a następnie zapisze wyniki w bazie danych. |
| **3.3: API Udostępniania Analizy** | Implementacja endpointów, które pozwolą administratorowi na udostępnianie lub ukrywanie wyników analizy przed uczestnikami. |

### Sprint 4: Frontend - Wyświetlanie Wyników Analizy

**Cel:** Prezentacja wyników analizy w przejrzysty i użyteczny sposób.

| Zadanie | Opis |
|---|---|
| **4.1: UI Wyników Analizy (Admin)** | Stworzenie komponentu LitElement `<analysis-viewer>`, który wyświetli wyniki analizy, historię poprzednich analiz oraz umożliwi udostępnienie raportu uczestnikom. |
| **4.2: UI Wyników Analizy (Uczestnik)** | Stworzenie uproszczonej wersji widoku wyników, która będzie widoczna dla uczestników tylko wtedy, gdy administrator udostępni analizę. |
```

## 8. Bezpieczeństwo i Prywatność (Uzupełnienie)

Sekcja ta została dodana w odpowiedzi na feedback i precyzuje kluczowe mechanizmy ochrony danych w systemie "Workshop Intelligence".

### 8.1. Uwierzytelnianie i Autoryzacja

*   **Uwierzytelnianie:** System w pełni opiera się na istniejącym mechanizmie uwierzytelniania w WorkshopsAI CMS. Każde żądanie do API jest weryfikowane za pomocą middleware `authenticateJWT`, co zapewnia, że tylko zalogowani użytkownicy mają dostęp do systemu.
*   **Autoryzacja:** Role użytkowników są precyzyjnie zdefiniowane i egzekwowane przez middleware `authorizeRoles`:
    *   **`participant`:** Może tworzyć i edytować **tylko własne** odpowiedzi. Nie ma dostępu do danych innych uczestników ani do wyników analizy (chyba że administrator ją udostępni).
    *   **`facilitator`:** Twórca i właściciel warsztatu. Może zarządzać formularzem, blokować edycję, uruchamiać analizy i udostępniać wyniki dla **swojego warsztatu**.
    *   **`admin`:** Super-user. Ma pełne uprawnienia do wszystkich warsztatów i analiz w systemie.

### 8.2. Anonimizacja Danych dla LLM

Przed wysłaniem danych do analizy przez LLM, system **bezwzględnie** przeprowadza proces anonimizacji. Jest to kluczowy element ochrony prywatności i zgodności z GDPR.

1.  **Usunięcie Danych Osobowych:** Z odpowiedzi uczestników usuwane są wszelkie dane, które mogłyby pozwolić na identyfikację (imiona, nazwiska, e-maile, nazwy firm itp.).
2.  **Zastąpienie Identyfikatorów:** Identyfikatory `userId` są zastępowane anonimowymi, jednorazowymi identyfikatorami (np. `Participant 1`, `Participant 2`).
3.  **Brak Powiązania:** Wyniki analizy przechowywane w bazie danych nie zawierają żadnych informacji pozwalających na powiązanie konkretnej odpowiedzi z konkretnym uczestnikiem.

```typescript
// Uproszczony przykład funkcji anonimizującej
function anonymizeForLLM(contributions: any[]): any[] {
  const piiPatterns = [/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, /\S+@\S+\.\S+/g]; // Regex dla imion i e-maili

  return contributions.map((contrib, index) => {
    const anonymizedAnswers = contrib.answers.map(ans => {
      let answerText = JSON.stringify(ans.answerData);
      for (const pattern of piiPatterns) {
        answerText = answerText.replace(pattern, '[REDACTED]');
      }
      return { ...ans, answerData: JSON.parse(answerText) };
    });

    return {
      participantId: `Participant_${index + 1}`,
      answers: anonymizedAnswers,
    };
  });
}
```

### 8.3. Zabezpieczenia API

*   **Walidacja Danych Wejściowych:** Wszystkie dane przychodzące do API są walidowane za pomocą biblioteki `zod`, co chroni przed atakami typu NoSQL injection i zapewnia spójność danych.
*   **Ograniczenie Zapytań (Rate Limiting):** API jest chronione przed atakami DoS poprzez mechanizm rate limiting, który ogranicza liczbę zapytań z jednego adresu IP.
*   **Ochrona przed XSS i CSRF:** System wykorzystuje standardowe zabezpieczenia wbudowane w Express.js i biblioteki takie jak `helmet` i `hpp`.
