/**
 * workshopsAI CMS - Internationalization System
 * Polish/English bilingual translations
 */

export type Language = 'pl' | 'en';
export type TranslationKey = keyof typeof translations.pl;

interface BilingualText {
  pl: string;
  en: string;
}

interface BilingualContent {
  pl: string;
  en: string;
}

// Complete translation dictionary
export const translations = {
  pl: {
    // App navigation and layout
    'app.name': 'workshopsAI CMS',
    'app.loading': 'Ładowanie aplikacji...',
    'app.skip_to_content': 'Przejdź do głównej treści',

    // Navigation
    'nav.dashboard': 'Panel główny',
    'nav.workshops': 'Warsztaty',
    'nav.create_workshop': 'Utwórz warsztat',
    'nav.questionnaires': 'Kwestionariusze',
    'nav.create_questionnaire': 'Utwórz kwestionariusz',
    'nav.enrollments': 'Zapisy',
    'nav.profile': 'Mój profil',
    'nav.settings': 'Ustawienia',
    'nav.users': 'Użytkownicy',
    'nav.logout': 'Wyloguj się',
    'nav.logged_in_as': 'Zalogowany jako:',
    'nav.language': 'Język',

    // Language switcher
    'lang.switch': 'Przełącz język',
    'lang.polish': 'Polski',
    'lang.english': 'English',

    // Authentication
    'auth.login': 'Logowanie',
    'auth.register': 'Rejestracja',
    'auth.email': 'Email',
    'auth.password': 'Hasło',
    'auth.confirm_password': 'Potwierdź hasło',
    'auth.remember_me': 'Zapamiętaj mnie',
    'auth.forgot_password': 'Zapomniałem hasła',
    'auth.login_button': 'Zaloguj się',
    'auth.register_button': 'Zarejestruj się',
    'auth.logout_button': 'Wyloguj się',
    'auth.login_to': 'Zaloguj się do',
    'auth.welcome_back': 'Witaj ponownie',
    'auth.create_account': 'Utwórz konto',
    'auth.no_account': 'Nie masz konta?',
    'auth.has_account': 'Masz już konto?',
    'auth.session_expired': 'Sesja wygasła. Zaloguj się ponownie.',
    'auth.login_success': 'Zalogowano pomyślnie',
    'auth.logout_success': 'Wylogowano pomyślnie',
    'auth.login_error': 'Błąd logowania',
    'auth.register_error': 'Błąd rejestracji',
    'auth.invalid_email': 'Nieprawidłowy format email',
    'auth.password_required': 'Hasło jest wymagane',
    'auth.all_fields_required': 'Wszystkie pola są wymagane',

    // User roles
    'role.participant': 'Uczestnik',
    'role.facilitator': 'Facylitator',
    'role.moderator': 'Moderator',
    'role.sociologist_editor': 'Socjolog-redaktor',
    'role.admin': 'Administrator',

    // Workshop management
    'workshop.title': 'Tytuł',
    'workshop.subtitle': 'Podtytuł',
    'workshop.description': 'Opis',
    'workshop.short_description': 'Krótki opis',
    'workshop.start_date': 'Data rozpoczęcia',
    'workshop.end_date': 'Data zakończenia',
    'workshop.seat_limit': 'Limit miejsc',
    'workshop.price': 'Cena',
    'workshop.language': 'Język',
    'workshop.location': 'Lokalizacja',
    'workshop.facilitator': 'Facylitator',
    'workshop.status': 'Status',
    'workshop.tags': 'Tagi',
    'workshop.requirements': 'Wymagania',
    'workshop.objectives': 'Cele',
    'workshop.materials': 'Materiały',

    // Workshop statuses
    'status.draft': 'Szkic',
    'status.published': 'Opublikowany',
    'status.archived': 'Zarchiwizowany',
    'status.cancelled': 'Anulowany',
    'status.pending': 'Oczekuje',
    'status.confirmed': 'Potwierdzony',
    'status.waitlisted': 'Na liście rezerwowej',
    'status.completed': 'Ukończony',

    // Actions
    'action.create': 'Utwórz',
    'action.edit': 'Edytuj',
    'action.save': 'Zapisz',
    'action.cancel': 'Anuluj',
    'action.delete': 'Usuń',
    'action.publish': 'Opublikuj',
    'action.archive': 'Archiwizuj',
    'action.duplicate': 'Duplikuj',
    'action.view': 'Zobacz',
    'action.details': 'Szczegóły',
    'action.back': 'Wróć',
    'action.next': 'Dalej',
    'action.previous': 'Poprzedni',
    'action.submit': 'Wyślij',
    'action.enroll': 'Zapisz się',
    'action.confirm': 'Potwierdź',
    'action.reject': 'Odrzuć',
    'action.export': 'Eksportuj',
    'action.import': 'Importuj',
    'action.search': 'Szukaj',
    'action.filter': 'Filtruj',
    'action.sort': 'Sortuj',
    'action.refresh': 'Odśwież',
    'action.download': 'Pobierz',
    'action.upload': 'Prześlij',

    // Questionnaire system
    'questionnaire.title': 'Tytuł kwestionariusza',
    'questionnaire.description': 'Opis kwestionariusza',
    'questionnaire.instructions': 'Instrukcje',
    'questionnaire.status': 'Status kwestionariusza',
    'questionnaire.sections': 'Sekcje',
    'questionnaire.questions': 'Pytania',
    'questionnaire.responses': 'Odpowiedzi',
    'questionnaire.template': 'Szablon',
    'questionnaire.create_from_template': 'Utwórz z szablonu',
    'questionnaire.create_blank': 'Utwórz pusty',
    'questionnaire.template_pdf': 'Szablon z PDF',
    'questionnaire.no_questions': 'Brak pytań',
    'questionnaire.progress': 'Postęp',
    'questionnaire.submission_success':
      'Twoje odpowiedzi zostały pomyślnie przesłane.',
    'questionnaire.type_placeholder': 'Twoja odpowiedź...',

    // Questionnaire statuses
    'q_status.draft': 'Szkic',
    'q_status.review': 'W recenzji',
    'q_status.published': 'Opublikowany',
    'q_status.closed': 'Zamknięty',
    'q_status.analyzed': 'Przeanalizowany',

    // Question types
    'q_type.text': 'Krótka odpowiedź',
    'q_type.textarea': 'Długa odpowiedź',
    'q_type.number': 'Liczba',
    'q_type.scale': 'Skala',
    'q_type.single_choice': 'Wybór pojedynczy',
    'q_type.multiple_choice': 'Wybór wielokrotny',

    // Question editing
    'question.text': 'Treść pytania',
    'question.type': 'Typ odpowiedzi',
    'question.required': 'Wymagane',
    'question.optional': 'Opcjonalne',
    'question.help_text': 'Tekst pomocy',
    'question.add_question': 'Dodaj pytanie',
    'question.add_section': 'Dodaj sekcję',
    'question.edit_question': 'Edytuj pytanie',
    'question.delete_question': 'Usuń pytanie',
    'question.move_up': 'Przesuń wyżej',
    'question.move_down': 'Przesuń niżej',
    'question.duplicate': 'Duplikuj',
    'question.validation': 'Walidacja',
    'question.min_length': 'Min znaków',
    'question.max_length': 'Max znaków',
    'question.min_value': 'Min wartość',
    'question.max_value': 'Max wartość',

    // GDPR Consent
    'gdpr.title': 'Zgoda na przetwarzanie danych',
    'gdpr.description':
      'Wypełniając ten kwestionariusz, wyrażasz zgodę na przetwarzanie Twoich danych osobowych.',
    'gdpr.ai_processing': 'Zgoda na przetwarzanie przez AI',
    'gdpr.ai_description':
      'Twoje odpowiedzi mogą być analizowane za pomocą sztucznej inteligencji w celach badawczych. Wszystkie dane zostaną zanonimizowane.',
    'gdpr.anonymous_responses': 'Anonimowe odpowiedzi',
    'gdpr.anonymous_description':
      'Twoje odpowiedzi będą przechowywane anonimowo i nie zostaną powiązane z Twoją tożsamością.',
    'gdpr.data_retention': 'Przechowywanie danych',
    'gdpr.data_retention_description':
      'Twoje dane będą przechowywane przez 5 lat i następnie usunięte.',
    'gdpr.consent_required': 'Zgoda jest wymagana',
    'gdpr.i_consent': 'Wyrażam zgodę',
    'gdpr.read_more': 'Czytaj więcej',

    // Form validation
    'validation.required': 'To pole jest wymagane',
    'validation.email': 'Podaj prawidłowy adres email',
    'validation.min_length': 'Minimalna długość: {{min}} znaków',
    'validation.max_length': 'Maksymalna długość: {{max}} znaków',
    'validation.min_value': 'Minimalna wartość: {{min}}',
    'validation.max_value': 'Maksymalna wartość: {{max}}',
    'validation.pattern': 'Nieprawidłowy format',
    'validation.file_size': 'Maksymalny rozmiar pliku: {{size}}',
    'validation.file_type': 'Nieprawidłowy typ pliku',
    'validation.required_fields': 'Uzupełnij wszystkie wymagane pola',

    // Messages and notifications
    'message.success': 'Operacja zakończona sukcesem',
    'message.error': 'Wystąpił błąd',
    'message.warning': 'Ostrzeżenie',
    'message.info': 'Informacja',
    'message.loading': 'Ładowanie...',
    'message.saved': 'Zapisano',
    'message.deleted': 'Usunięto',
    'message.published': 'Opublikowano',
    'message.archived': 'Zarchiwizowano',
    'message.enrolled': 'Zapisano pomyślnie',
    'message.enrollment_error': 'Błąd zapisu',
    'message.no_results': 'Brak wyników',
    'message.confirm_delete': 'Czy na pewno chcesz usunąć ten element?',
    'message.unsaved_changes': 'Masz niezapisane zmiany',
    'message.network_error': 'Błąd połączenia z siecią',
    'message.server_error': 'Błąd serwera',

    // Dashboard
    'dashboard.welcome': 'Witaj, {{name}}!',
    'dashboard.total_workshops': 'Warsztaty',
    'dashboard.total_enrollments': 'Zapisy',
    'dashboard.published': 'Opublikowane',
    'dashboard.drafts': 'Szkice',
    'dashboard.recent_workshops': 'Ostatnie dodane warsztaty',
    'dashboard.recent_enrollments': 'Ostatnie zapisy',
    'dashboard.no_workshops': 'Brak warsztatów',
    'dashboard.no_enrollments': 'Brak zapisów',

    // Tables
    'table.workshop': 'Warsztat',
    'table.participant': 'Uczestnik',
    'table.status': 'Status',
    'table.date': 'Data',
    'table.actions': 'Akcje',
    'table.empty': 'Brak danych',
    'table.loading': 'Ładowanie danych...',

    // Pagination
    'pagination.previous': 'Poprzednia',
    'pagination.next': 'Następna',
    'pagination.showing': 'Pokazuję {{from}}-{{to}} z {{total}}',

    // Accessibility
    'a11y.close': 'Zamknij',
    'a11y.open': 'Otwórz',
    'a11y.menu': 'Menu',
    'a11y.search': 'Wyszukiwanie',
    'a11y.loading': 'Ładowanie',
    'a11y.error': 'Błąd',
    'a11y.notification': 'Powiadomienie',
    'a11y.required': 'Wymagane',
    'a11y.optional': 'Opcjonalne',

    // File upload
    'upload.drag_drop': 'Przeciągnij i upuść pliki tutaj',
    'upload.or_click': 'lub kliknij aby wybrać',
    'upload.uploading': 'Przesyłanie...',
    'upload.success': 'Przesłano pomyślnie',
    'upload.error': 'Błąd przesyłania',
    'upload.file_too_big': 'Plik jest zbyt duży',
    'upload.invalid_type': 'Nieprawidłowy typ pliku',

    // Date and time
    'date.today': 'Dziś',
    'date.yesterday': 'Wczoraj',
    'date.tomorrow': 'Jutro',
    'date.this_week': 'W tym tygodniu',
    'date.this_month': 'W tym miesiącu',
    'date.format': 'DD.MM.YYYY',
    'time.format': 'HH:mm',
    'datetime.format': 'DD.MM.YYYY HH:mm',

    // Currencies
    'currency.pln': 'zł',
    'currency.eur': '€',
    'currency.usd': '$',
  },

  en: {
    // App navigation and layout
    'app.name': 'workshopsAI CMS',
    'app.loading': 'Loading application...',
    'app.skip_to_content': 'Skip to main content',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.workshops': 'Workshops',
    'nav.create_workshop': 'Create Workshop',
    'nav.questionnaires': 'Questionnaires',
    'nav.create_questionnaire': 'Create Questionnaire',
    'nav.enrollments': 'Enrollments',
    'nav.profile': 'My Profile',
    'nav.settings': 'Settings',
    'nav.users': 'Users',
    'nav.logout': 'Logout',
    'nav.logged_in_as': 'Logged in as:',
    'nav.language': 'Language',

    // Language switcher
    'lang.switch': 'Switch Language',
    'lang.polish': 'Polski',
    'lang.english': 'English',

    // Authentication
    'auth.login': 'Login',
    'auth.register': 'Register',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.confirm_password': 'Confirm Password',
    'auth.remember_me': 'Remember Me',
    'auth.forgot_password': 'Forgot Password',
    'auth.login_button': 'Sign In',
    'auth.register_button': 'Sign Up',
    'auth.logout_button': 'Sign Out',
    'auth.login_to': 'Sign in to',
    'auth.welcome_back': 'Welcome Back',
    'auth.create_account': 'Create Account',
    'auth.no_account': 'Don\'t have an account?',
    'auth.has_account': 'Already have an account?',
    'auth.session_expired': 'Session expired. Please log in again.',
    'auth.login_success': 'Logged in successfully',
    'auth.logout_success': 'Logged out successfully',
    'auth.login_error': 'Login error',
    'auth.register_error': 'Registration error',
    'auth.invalid_email': 'Invalid email format',
    'auth.password_required': 'Password is required',
    'auth.all_fields_required': 'All fields are required',

    // User roles
    'role.participant': 'Participant',
    'role.facilitator': 'Facilitator',
    'role.moderator': 'Moderator',
    'role.sociologist_editor': 'Sociologist-Editor',
    'role.admin': 'Administrator',

    // Workshop management
    'workshop.title': 'Title',
    'workshop.subtitle': 'Subtitle',
    'workshop.description': 'Description',
    'workshop.short_description': 'Short Description',
    'workshop.start_date': 'Start Date',
    'workshop.end_date': 'End Date',
    'workshop.seat_limit': 'Seat Limit',
    'workshop.price': 'Price',
    'workshop.language': 'Language',
    'workshop.location': 'Location',
    'workshop.facilitator': 'Facilitator',
    'workshop.status': 'Status',
    'workshop.tags': 'Tags',
    'workshop.requirements': 'Requirements',
    'workshop.objectives': 'Objectives',
    'workshop.materials': 'Materials',

    // Workshop statuses
    'status.draft': 'Draft',
    'status.published': 'Published',
    'status.archived': 'Archived',
    'status.cancelled': 'Cancelled',
    'status.pending': 'Pending',
    'status.confirmed': 'Confirmed',
    'status.waitlisted': 'Waitlisted',
    'status.completed': 'Completed',

    // Actions
    'action.create': 'Create',
    'action.edit': 'Edit',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.publish': 'Publish',
    'action.archive': 'Archive',
    'action.duplicate': 'Duplicate',
    'action.view': 'View',
    'action.details': 'Details',
    'action.back': 'Back',
    'action.next': 'Next',
    'action.previous': 'Previous',
    'action.submit': 'Submit',
    'action.enroll': 'Enroll',
    'action.confirm': 'Confirm',
    'action.reject': 'Reject',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.search': 'Search',
    'action.filter': 'Filter',
    'action.sort': 'Sort',
    'action.refresh': 'Refresh',
    'action.download': 'Download',
    'action.upload': 'Upload',

    // Questionnaire system
    'questionnaire.title': 'Questionnaire Title',
    'questionnaire.description': 'Questionnaire Description',
    'questionnaire.instructions': 'Instructions',
    'questionnaire.status': 'Questionnaire Status',
    'questionnaire.sections': 'Sections',
    'questionnaire.questions': 'Questions',
    'questionnaire.responses': 'Responses',
    'questionnaire.template': 'Template',
    'questionnaire.create_from_template': 'Create from Template',
    'questionnaire.create_blank': 'Create Blank',
    'questionnaire.template_pdf': 'PDF Template',
    'questionnaire.no_questions': 'No questions',
    'questionnaire.progress': 'Progress',
    'questionnaire.submission_success':
      'Your responses have been successfully submitted.',
    'questionnaire.type_placeholder': 'Your answer...',

    // Questionnaire statuses
    'q_status.draft': 'Draft',
    'q_status.review': 'Review',
    'q_status.published': 'Published',
    'q_status.closed': 'Closed',
    'q_status.analyzed': 'Analyzed',

    // Question types
    'q_type.text': 'Short Answer',
    'q_type.textarea': 'Long Answer',
    'q_type.number': 'Number',
    'q_type.scale': 'Scale',
    'q_type.single_choice': 'Single Choice',
    'q_type.multiple_choice': 'Multiple Choice',

    // Question editing
    'question.text': 'Question Text',
    'question.type': 'Answer Type',
    'question.required': 'Required',
    'question.optional': 'Optional',
    'question.help_text': 'Help Text',
    'question.add_question': 'Add Question',
    'question.add_section': 'Add Section',
    'question.edit_question': 'Edit Question',
    'question.delete_question': 'Delete Question',
    'question.move_up': 'Move Up',
    'question.move_down': 'Move Down',
    'question.duplicate': 'Duplicate',
    'question.validation': 'Validation',
    'question.min_length': 'Min characters',
    'question.max_length': 'Max characters',
    'question.min_value': 'Min value',
    'question.max_value': 'Max value',

    // GDPR Consent
    'gdpr.title': 'Data Processing Consent',
    'gdpr.description':
      'By completing this questionnaire, you consent to the processing of your personal data.',
    'gdpr.ai_processing': 'AI Processing Consent',
    'gdpr.ai_description':
      'Your responses may be analyzed using artificial intelligence for research purposes. All data will be anonymized.',
    'gdpr.anonymous_responses': 'Anonymous Responses',
    'gdpr.anonymous_description':
      'Your responses will be stored anonymously and will not be linked to your identity.',
    'gdpr.data_retention': 'Data Retention',
    'gdpr.data_retention_description':
      'Your data will be stored for 5 years and then deleted.',
    'gdpr.consent_required': 'Consent is required',
    'gdpr.i_consent': 'I consent',
    'gdpr.read_more': 'Read more',

    // Form validation
    'validation.required': 'This field is required',
    'validation.email': 'Please enter a valid email address',
    'validation.min_length': 'Minimum length: {{min}} characters',
    'validation.max_length': 'Maximum length: {{max}} characters',
    'validation.min_value': 'Minimum value: {{min}}',
    'validation.max_value': 'Maximum value: {{max}}',
    'validation.pattern': 'Invalid format',
    'validation.file_size': 'Maximum file size: {{size}}',
    'validation.file_type': 'Invalid file type',

    // Messages and notifications
    'message.success': 'Operation completed successfully',
    'message.error': 'An error occurred',
    'message.warning': 'Warning',
    'message.info': 'Information',
    'message.loading': 'Loading...',
    'message.saved': 'Saved',
    'message.deleted': 'Deleted',
    'message.published': 'Published',
    'message.archived': 'Archived',
    'message.enrolled': 'Enrolled successfully',
    'message.enrollment_error': 'Enrollment error',
    'message.no_results': 'No results found',
    'message.confirm_delete': 'Are you sure you want to delete this item?',
    'message.unsaved_changes': 'You have unsaved changes',
    'message.network_error': 'Network error',
    'message.server_error': 'Server error',

    // Dashboard
    'dashboard.welcome': 'Welcome, {{name}}!',
    'dashboard.total_workshops': 'Workshops',
    'dashboard.total_enrollments': 'Enrollments',
    'dashboard.published': 'Published',
    'dashboard.drafts': 'Drafts',
    'dashboard.recent_workshops': 'Recent Workshops',
    'dashboard.recent_enrollments': 'Recent Enrollments',
    'dashboard.no_workshops': 'No workshops',
    'dashboard.no_enrollments': 'No enrollments',

    // Tables
    'table.workshop': 'Workshop',
    'table.participant': 'Participant',
    'table.status': 'Status',
    'table.date': 'Date',
    'table.actions': 'Actions',
    'table.empty': 'No data available',
    'table.loading': 'Loading data...',

    // Pagination
    'pagination.previous': 'Previous',
    'pagination.next': 'Next',
    'pagination.showing': 'Showing {{from}}-{{to}} of {{total}}',

    // Accessibility
    'a11y.close': 'Close',
    'a11y.open': 'Open',
    'a11y.menu': 'Menu',
    'a11y.search': 'Search',
    'a11y.loading': 'Loading',
    'a11y.error': 'Error',
    'a11y.notification': 'Notification',
    'a11y.required': 'Required',
    'a11y.optional': 'Optional',

    // File upload
    'upload.drag_drop': 'Drag and drop files here',
    'upload.or_click': 'or click to select',
    'upload.uploading': 'Uploading...',
    'upload.success': 'Uploaded successfully',
    'upload.error': 'Upload error',
    'upload.file_too_big': 'File is too large',
    'upload.invalid_type': 'Invalid file type',

    // Date and time
    'date.today': 'Today',
    'date.yesterday': 'Yesterday',
    'date.tomorrow': 'Tomorrow',
    'date.this_week': 'This week',
    'date.this_month': 'This month',
    'date.format': 'MM/DD/YYYY',
    'time.format': 'HH:mm',
    'datetime.format': 'MM/DD/YYYY HH:mm',

    // Currencies
    'currency.pln': 'PLN',
    'currency.eur': 'EUR',
    'currency.usd': 'USD',
  },
};

// Template content for the "NASZA (NIE)UTOPIA" questionnaire
export const questionnaireTemplate = {
  title: {
    pl: 'NASZA (NIE)UTOPIA',
    en: 'OUR (DIS)UTOPIA',
  },
  instructions: {
    pl: 'Wypełnij kwestionariusz opisujący Waszą wizję wspólnoty. Pamiętaj, że wszystkie odpowiedzi są ważne i nie ma złych odpowiedzi.',
    en: 'Complete the questionnaire describing your community vision. Remember that all answers are valuable and there are no wrong answers.',
  },
  sections: [
    {
      title: {
        pl: '1. WIZJA / MANIFEST',
        en: '1. VISION / MANIFEST',
      },
      description: {
        pl: 'Kluczowe wartości i cele Waszej wspólnoty',
        en: 'Key values and goals of your community',
      },
      questions: [
        {
          label: {
            pl: 'Kluczowe wartości',
            en: 'Key Values',
          },
          text: {
            pl: 'Co jest dla Was ważne we wspólnym miejscu zamieszkania? Co leży u podstaw tego pomysłu? Z jakimi wartościami utożsamiacie się?',
            en: 'What is important to you in a shared living space? What is the foundation of this idea? What values do you identify with?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 500 },
        },
        {
          label: {
            pl: 'Cel',
            en: 'Purpose',
          },
          text: {
            pl: 'Dlaczego Wasze miejsce istnieje? By żyło się łatwiej, zabawniej I na własnych zasadach',
            en: 'Why does your place exist? So that life is easier, more fun, and on your own terms',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
      ],
    },
    // ... more sections from cmsplan6.md
  ],
};

// Export types and helpers
export type { BilingualText, BilingualContent };
export default translations;
