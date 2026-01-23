import { EmailTranslations } from '../types';

export const da: EmailTranslations = {
  common: {
    greeting: 'Hej',
    thankYou: 'Tak fordi du valgte PolicyTracker!',
    bestRegards: 'Med venlig hilsen',
    team: 'PolicyTracker-teamet',
    questionsContact:
      'Har du spørgsmål? Svar på denne e-mail eller kontakt os på hello@policytracker.eu',
    automatedMessage:
      'Dette er en automatisk besked. Svar venligst ikke direkte.',
    viewOnline: 'Se i browser',
    unsubscribe: 'Afmeld',
  },

  auditConfirmation: {
    subject: 'Din GDPR-auditanmodning er modtaget',
    preheader: 'Vi scanner dit websted for GDPR-overholdelsesproblemer',
    title: '🎯 Din auditanmodning er bekræftet!',
    intro:
      'Tak for at indsende dit websted til en GDPR-overholdelses-audit. Vi tager privatlivets fred alvorligt, og vi er her for at hjælpe.',
    websiteLabel: 'Websted',
    auditIdLabel: 'Audit-ID',
    whatHappensNext: 'Hvad sker der nu?',
    step1: '🔍 Vores AI scanner dit websted på 50+ overholdelses-checkpunkter',
    step2:
      '📊 Vi analyserer cookies, trackere, samtykke-bannere og privatlivspolitikker',
    step3: '📧 Du modtager din detaljerede overholdelses-rapport via e-mail',
    estimatedTime: 'Estimeret tid: 5-15 minutter',
    tipTitle: '💡 Pro-tip',
    tipContent:
      'Mens du venter, kan du gennemgå din nuværende privatlivspolitik. Er den opdateret? Forklarer den tydeligt, hvordan du indsamler og bruger personlige data?',
  },

  auditResults: {
    subject: 'Din GDPR-auditrapport er klar',
    preheader: 'Din websteds overholdelses-score og anbefalinger er klar',
    title: '📊 Din GDPR-overholdelses-rapport',
    intro:
      'Gode nyheder! Din websteds-audit er færdig. Her er en oversigt over din GDPR-overholdelsesstatus.',
    scoreLabel: 'Overholdelses-score',
    scoreExcellent: 'Fremragende',
    scoreGood: 'God',
    scoreNeedsImprovement: 'Kræver forbedring',
    scoreCritical: 'Kritisk',
    summaryTitle: 'Oversigt',
    issuesFound: 'Fundne problemer',
    passedChecks: 'Beståede kontroller',
    viewFullReport: 'Se fuld rapport',
    topIssuesTitle: 'Prioritetsproblemer',
    upgradeTitle: '🚀 Lås op for din fulde rapport',
    upgradeDescription:
      'Få detaljerede udbedringsstrin, kodestykker og en prioriteret handlingsplan for at blive fuldt GDPR-kompatibel.',
    upgradeButton: 'Få fuld rapport',
    freeReportNote:
      'Dette er din gratis opsummeringsrapport. Opgrader for at få adgang til den fulde analyse med handlingsbare anbefalinger.',
  },

  paymentConfirmation: {
    subject: 'Betaling bekræftet - Fuld GDPR-rapport låst op',
    preheader:
      'Din betaling var vellykket. Få adgang til din fulde rapport nu.',
    title: '✅ Betaling gennemført!',
    intro:
      'Tak for dit køb! Din fulde GDPR-overholdelses-rapport er nu låst op og klar til visning.',
    orderDetails: 'Ordredetaljer',
    productLabel: 'Produkt',
    productName: 'Fuld GDPR-overholdelses-rapport',
    amountLabel: 'Beløb',
    dateLabel: 'Dato',
    invoiceNote: 'En kvittering er sendt til din e-mailadresse.',
    accessReport: 'Få adgang til din fulde rapport',
    supportNote:
      'Har du brug for hjælp til at forstå din rapport? Vores team er her for at hjælpe.',
  },

  adminNotification: {
    subject: 'Ny auditanmodning',
    newRequest: 'Ny auditanmodning modtaget',
    details: 'Anmodningsdetaljer',
    marketingOptIn: 'Marketing-samtykke',
    yes: 'Ja',
    no: 'Nej',
  },
};
