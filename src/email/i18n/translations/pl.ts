import { EmailTranslations } from '../types';

export const pl: EmailTranslations = {
  common: {
    greeting: 'Cześć',
    thankYou: 'Dziękujemy za wybór PolicyTracker!',
    bestRegards: 'Z poważaniem',
    team: 'Zespół PolicyTracker',
    questionsContact:
      'Masz pytania? Odpowiedz na ten e-mail lub skontaktuj się z nami pod adresem hello@policytracker.eu',
    automatedMessage:
      'To jest wiadomość automatyczna. Prosimy nie odpowiadać bezpośrednio.',
    viewOnline: 'Zobacz w przeglądarce',
    unsubscribe: 'Wypisz się',
  },

  auditConfirmation: {
    subject: 'Twoje zgłoszenie audytu RODO zostało przyjęte',
    preheader: 'Skanujemy Twoją stronę pod kątem zgodności z RODO',
    title: '🎯 Twoje zgłoszenie audytu zostało potwierdzone!',
    intro:
      'Dziękujemy za przesłanie strony internetowej do audytu zgodności z RODO. Traktujemy prywatność poważnie i jesteśmy tutaj, aby Ci pomóc.',
    websiteLabel: 'Strona internetowa',
    auditIdLabel: 'ID audytu',
    whatHappensNext: 'Co dalej?',
    step1:
      '🔍 Nasza AI skanuje Twoją stronę pod kątem ponad 50 punktów kontrolnych',
    step2:
      '📊 Analizujemy pliki cookie, trackery, banery zgody i polityki prywatności',
    step3: '📧 Otrzymasz szczegółowy raport zgodności na e-mail',
    estimatedTime: 'Szacowany czas: 5-15 minut',
    tipTitle: '💡 Porada',
    tipContent:
      'W międzyczasie przejrzyj swoją aktualną politykę prywatności. Czy jest aktualna? Czy jasno wyjaśnia, jak zbierasz i wykorzystujesz dane osobowe?',
  },

  auditResults: {
    subject: 'Twój raport audytu RODO jest gotowy',
    preheader: 'Wynik zgodności Twojej strony i rekomendacje są gotowe',
    title: '📊 Twój raport zgodności z RODO',
    intro:
      'Świetna wiadomość! Audyt Twojej strony został zakończony. Oto podsumowanie Twojego statusu zgodności z RODO.',
    scoreLabel: 'Wynik zgodności',
    scoreExcellent: 'Doskonały',
    scoreGood: 'Dobry',
    scoreNeedsImprovement: 'Wymaga poprawy',
    scoreCritical: 'Krytyczny',
    summaryTitle: 'Podsumowanie',
    issuesFound: 'Znalezione problemy',
    passedChecks: 'Zaliczone kontrole',
    viewFullReport: 'Zobacz pełny raport',
    topIssuesTitle: 'Problemy priorytetowe',
    upgradeTitle: '🚀 Odblokuj pełny raport',
    upgradeDescription:
      'Otrzymaj szczegółowe kroki naprawcze, fragmenty kodu i priorytetyzowany plan działania, aby osiągnąć pełną zgodność z RODO.',
    upgradeButton: 'Pobierz pełny raport',
    freeReportNote:
      'To jest Twój bezpłatny raport podsumowujący. Przejdź na wersję płatną, aby uzyskać dostęp do pełnej analizy z praktycznymi rekomendacjami.',
  },

  paymentConfirmation: {
    subject: 'Płatność potwierdzona - Pełny raport RODO odblokowany',
    preheader:
      'Twoja płatność została zrealizowana. Uzyskaj dostęp do pełnego raportu.',
    title: '✅ Płatność udana!',
    intro:
      'Dziękujemy za zakup! Twój pełny raport zgodności z RODO jest teraz odblokowany i gotowy do przeglądania.',
    orderDetails: 'Szczegóły zamówienia',
    productLabel: 'Produkt',
    productName: 'Pełny raport zgodności z RODO',
    amountLabel: 'Kwota',
    dateLabel: 'Data',
    invoiceNote: 'Potwierdzenie zostało wysłane na Twój adres e-mail.',
    accessReport: 'Uzyskaj dostęp do pełnego raportu',
    supportNote:
      'Potrzebujesz pomocy w zrozumieniu raportu? Nasz zespół jest do Twojej dyspozycji.',
  },

  adminNotification: {
    subject: 'Nowe zgłoszenie audytu',
    newRequest: 'Otrzymano nowe zgłoszenie audytu',
    details: 'Szczegóły zgłoszenia',
    marketingOptIn: 'Zgoda marketingowa',
    yes: 'Tak',
    no: 'Nie',
  },
};
