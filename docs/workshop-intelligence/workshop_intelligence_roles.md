# Workshop Intelligence: Role i Uprawnienia

**Wersja:** 1.0  
**Data:** 30 listopada 2025  
**Autor:** Manus AI

## 1. Wprowadzenie

Niniejszy dokument precyzyjnie definiuje role użytkowników w systemie "Workshop Intelligence" oraz przypisane im uprawnienia. Dokument powstał w odpowiedzi na feedback dotyczący konieczności doprecyzowania ról i ich rozróżnienia.

## 2. Definicje Ról

System "Workshop Intelligence" rozpoznaje trzy główne role użytkowników, które są dziedziczone z systemu WorkshopsAI CMS:

### 2.1. Participant (Uczestnik)

**Definicja:** Osoba zapisana na warsztat, która wypełnia formularz z pomysłami, oczekiwaniami i wyzwaniami.

**Charakterystyka:**
- Najniższy poziom uprawnień w systemie
- Dostęp ograniczony wyłącznie do własnych danych
- Nie ma wglądu w odpowiedzi innych uczestników
- Nie ma dostępu do wyników analizy (chyba że administrator/facylitator je udostępni)

**Typowe przypadki użycia:**
- Wypełnianie formularza przed warsztatem
- Edycja swoich odpowiedzi (jeśli formularz nie jest zablokowany)
- Przeglądanie udostępnionych przez administratora wyników analizy

### 2.2. Facilitator (Facylitator)

**Definicja:** Twórca i właściciel warsztatu. Osoba odpowiedzialna za przygotowanie i prowadzenie warsztatu.

**Charakterystyka:**
- Średni poziom uprawnień
- Pełna kontrola nad **własnymi warsztatami**
- Może zarządzać formularzami, uruchamiać analizy i udostępniać wyniki
- **Nie ma** dostępu do warsztatów innych facylitatorów (chyba że jest również adminem)

**Typowe przypadki użycia:**
- Tworzenie formularza dla swojego warsztatu
- Dodawanie i edycja pytań w formularzu
- Blokowanie/odblokowywanie możliwości edycji przez uczestników
- Uruchamianie analizy LLM
- Przeglądanie wyników analizy
- Udostępnianie wyników uczestnikom

**Uwaga:** W kontekście WorkshopsAI CMS, facylitator to użytkownik, który **utworzył** dany warsztat (pole `createdBy` w tabeli `workshops`).

### 2.3. Admin (Administrator)

**Definicja:** Super-user z pełnymi uprawnieniami do wszystkich funkcji systemu.

**Charakterystyka:**
- Najwyższy poziom uprawnień
- Dostęp do **wszystkich** warsztatów w systemie
- Może zarządzać formularzami, analizami i wynikami dla dowolnego warsztatu
- Może tworzyć i edytować szablony promptów (globalne)

**Typowe przypadki użycia:**
- Zarządzanie warsztatami innych facylitatorów
- Tworzenie globalnych szablonów promptów
- Moderacja i nadzór nad systemem
- Rozwiązywanie problemów technicznych

## 3. Macierz Uprawnień

Poniższa tabela przedstawia szczegółowe uprawnienia dla każdej roli w kontekście kluczowych operacji w systemie.

| Operacja | Participant | Facilitator | Admin |
|---|---|---|---|
| **Formularze** |
| Przeglądanie formularza warsztatu | ✅ (tylko dla warsztatów, w których uczestniczy) | ✅ (tylko własne warsztaty) | ✅ (wszystkie) |
| Tworzenie formularza | ❌ | ✅ (tylko dla własnych warsztatów) | ✅ (wszystkie) |
| Dodawanie pytań do formularza | ❌ | ✅ (tylko własne warsztaty) | ✅ (wszystkie) |
| Edycja pytań w formularzu | ❌ | ✅ (tylko własne warsztaty) | ✅ (wszystkie) |
| Usuwanie pytań z formularza | ❌ | ✅ (tylko własne warsztaty) | ✅ (wszystkie) |
| Blokowanie/odblokowywanie formularza | ❌ | ✅ (tylko własne warsztaty) | ✅ (wszystkie) |
| **Odpowiedzi Uczestników** |
| Wypełnianie formularza | ✅ (tylko własne odpowiedzi) | ✅ (jako uczestnik) | ✅ (jako uczestnik) |
| Edycja własnych odpowiedzi | ✅ (jeśli formularz nie jest zablokowany) | ✅ (jako uczestnik) | ✅ (jako uczestnik) |
| Przeglądanie własnych odpowiedzi | ✅ | ✅ (jako uczestnik) | ✅ (jako uczestnik) |
| Przeglądanie odpowiedzi innych uczestników | ❌ | ✅ (tylko własne warsztaty, zanonimizowane) | ✅ (wszystkie, zanonimizowane) |
| **Analizy LLM** |
| Uruchamianie analizy | ❌ | ✅ (tylko własne warsztaty) | ✅ (wszystkie) |
| Wybór modelu LLM | ❌ | ✅ (tylko własne warsztaty) | ✅ (wszystkie) |
| Wybór/tworzenie szablonu promptu | ❌ | ✅ (własne szablony + globalne) | ✅ (wszystkie) |
| Przeglądanie wyników analizy | ⚠️ (tylko jeśli udostępnione) | ✅ (tylko własne warsztaty) | ✅ (wszystkie) |
| Udostępnianie wyników uczestnikom | ❌ | ✅ (tylko własne warsztaty) | ✅ (wszystkie) |
| Ukrywanie wyników przed uczestnikami | ❌ | ✅ (tylko własne warsztaty) | ✅ (wszystkie) |
| **Szablony Promptów** |
| Przeglądanie globalnych szablonów | ❌ | ✅ | ✅ |
| Tworzenie własnych szablonów | ❌ | ✅ | ✅ |
| Tworzenie globalnych szablonów | ❌ | ❌ | ✅ |
| Edycja własnych szablonów | ❌ | ✅ | ✅ |
| Edycja globalnych szablonów | ❌ | ❌ | ✅ |

**Legenda:**
- ✅ = Dozwolone
- ❌ = Zabronione
- ⚠️ = Warunkowe (zależy od ustawień)

## 4. Implementacja w Kodzie

### 4.1. Middleware Autoryzacji

System wykorzystuje middleware `authorizeRoles` do weryfikacji uprawnień:

```typescript
// Przykład: Tylko admin i facilitator mogą tworzyć formularze
router.post(
  '/forms',
  authenticateJWT,
  authorizeRoles(['admin', 'facilitator']),
  async (req, res) => {
    // ...
  }
);
```

### 4.2. Weryfikacja Własności Zasobów

Dla operacji, które facylitator może wykonywać tylko na **własnych** warsztatach, system dodatkowo weryfikuje pole `createdBy`:

```typescript
// Pseudo-kod weryfikacji własności
const workshop = await getWorkshopById(workshopId);

if (req.user.role === 'facilitator' && workshop.createdBy !== req.user.id) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

## 5. Przypadki Brzegowe

### 5.1. Facylitator jako Uczestnik

Facylitator może być jednocześnie uczestnikiem własnego warsztatu. W takim przypadku:
- Może wypełnić formularz jako uczestnik
- Jego odpowiedzi są traktowane tak samo jak odpowiedzi innych uczestników
- Podczas analizy LLM jego odpowiedzi są również anonimizowane

### 5.2. Admin jako Facylitator

Admin może tworzyć własne warsztaty. W takim przypadku:
- Jest zarówno adminem (globalnie), jak i facylitatorem (dla swojego warsztatu)
- Ma pełne uprawnienia do wszystkich warsztatów, nie tylko własnych

### 5.3. Zmiana Roli Użytkownika

Jeśli rola użytkownika zostanie zmieniona (np. z `participant` na `facilitator`):
- Zmiana jest natychmiastowa i wpływa na kolejne żądania
- Poprzednie odpowiedzi uczestnika pozostają w systemie
- Nowe uprawnienia obowiązują od momentu zmiany

## 6. Bezpieczeństwo

### 6.1. Zasada Najmniejszych Uprawnień

System stosuje zasadę najmniejszych uprawnień (Principle of Least Privilege):
- Każda rola ma dostęp tylko do niezbędnych zasobów
- Brak możliwości eskalacji uprawnień bez zmiany roli przez admina

### 6.2. Audyt Działań

Wszystkie kluczowe operacje (tworzenie formularzy, uruchamianie analiz, udostępnianie wyników) są logowane w tabeli `audit_logs` z informacją o:
- Użytkowniku, który wykonał operację
- Czasie wykonania
- Typie operacji
- Zmienionych danych

## 7. Podsumowanie

Precyzyjne zdefiniowanie ról i uprawnień jest kluczowe dla bezpieczeństwa i użyteczności systemu "Workshop Intelligence". Niniejszy dokument stanowi punkt odniesienia dla wszystkich decyzji projektowych i implementacyjnych związanych z kontrolą dostępu.
