import { EmailTranslations } from '../types';

export const it: EmailTranslations = {
  common: {
    greeting: 'Ciao',
    thankYou: 'Grazie per aver scelto PolicyTracker!',
    bestRegards: 'Cordiali saluti',
    team: 'Il team di PolicyTracker',
    questionsContact:
      'Hai domande? Rispondi a questa email o contattaci a hello@policytracker.eu',
    automatedMessage:
      'Questo è un messaggio automatico. Si prega di non rispondere direttamente.',
    viewOnline: 'Visualizza nel browser',
    unsubscribe: 'Annulla iscrizione',
  },

  auditConfirmation: {
    subject: 'La tua richiesta di audit GDPR è stata ricevuta',
    preheader:
      'Stiamo scansionando il tuo sito web per problemi di conformità GDPR',
    title: '🎯 La tua richiesta di audit è confermata!',
    intro:
      'Grazie per aver inviato il tuo sito web per un audit di conformità GDPR. Prendiamo la privacy sul serio e siamo qui per aiutarti.',
    websiteLabel: 'Sito web',
    auditIdLabel: 'ID audit',
    whatHappensNext: 'Cosa succede dopo?',
    step1:
      '🔍 La nostra IA scansiona il tuo sito web su oltre 50 punti di controllo',
    step2:
      '📊 Analizziamo cookie, tracker, banner di consenso e informative sulla privacy',
    step3: '📧 Riceverai il tuo rapporto dettagliato di conformità via email',
    estimatedTime: 'Tempo stimato: 5-15 minuti',
    tipTitle: '💡 Suggerimento Pro',
    tipContent:
      'Mentre aspetti, rivedi la tua attuale informativa sulla privacy. È aggiornata? Spiega chiaramente come raccogli e utilizzi i dati personali?',
  },

  auditResults: {
    subject: 'Il tuo rapporto di audit GDPR è pronto',
    preheader:
      'Il punteggio di conformità del tuo sito e le raccomandazioni sono pronti',
    title: '📊 Il tuo rapporto di conformità GDPR',
    intro:
      "Ottime notizie! L'audit del tuo sito web è completato. Ecco un riepilogo del tuo stato di conformità GDPR.",
    scoreLabel: 'Punteggio di conformità',
    scoreExcellent: 'Eccellente',
    scoreGood: 'Buono',
    scoreNeedsImprovement: 'Da migliorare',
    scoreCritical: 'Critico',
    summaryTitle: 'Riepilogo',
    issuesFound: 'Problemi trovati',
    passedChecks: 'Controlli superati',
    viewFullReport: 'Visualizza rapporto completo',
    topIssuesTitle: 'Problemi prioritari',
    upgradeTitle: '🚀 Sblocca il tuo rapporto completo',
    upgradeDescription:
      "Ottieni passaggi dettagliati di correzione, frammenti di codice e un piano d'azione prioritario per raggiungere la piena conformità GDPR.",
    upgradeButton: 'Ottieni rapporto completo',
    freeReportNote:
      "Questo è il tuo rapporto riassuntivo gratuito. Effettua l'upgrade per accedere all'analisi completa con raccomandazioni attuabili.",
  },

  paymentConfirmation: {
    subject: 'Pagamento confermato - Rapporto GDPR completo sbloccato',
    preheader:
      'Il tuo pagamento è andato a buon fine. Accedi ora al tuo rapporto completo.',
    title: '✅ Pagamento riuscito!',
    intro:
      'Grazie per il tuo acquisto! Il tuo rapporto completo di conformità GDPR è ora sbloccato e pronto per la visualizzazione.',
    orderDetails: "Dettagli dell'ordine",
    productLabel: 'Prodotto',
    productName: 'Rapporto completo di conformità GDPR',
    amountLabel: 'Importo',
    dateLabel: 'Data',
    invoiceNote: 'Una ricevuta è stata inviata al tuo indirizzo email.',
    accessReport: 'Accedi al tuo rapporto completo',
    supportNote:
      'Hai bisogno di aiuto per comprendere il tuo rapporto? Il nostro team è qui per assisterti.',
  },

  adminNotification: {
    subject: 'Nuova richiesta di audit',
    newRequest: 'Nuova richiesta di audit ricevuta',
    details: 'Dettagli della richiesta',
    marketingOptIn: 'Opt-in marketing',
    yes: 'Sì',
    no: 'No',
  },
};
