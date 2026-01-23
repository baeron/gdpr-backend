import { EmailTranslations } from '../types';

export const sv: EmailTranslations = {
  common: {
    greeting: 'Hej',
    thankYou: 'Tack för att du valde PolicyTracker!',
    bestRegards: 'Med vänliga hälsningar',
    team: 'PolicyTracker-teamet',
    questionsContact:
      'Har du frågor? Svara på detta e-postmeddelande eller kontakta oss på hello@policytracker.eu',
    automatedMessage:
      'Detta är ett automatiskt meddelande. Vänligen svara inte direkt.',
    viewOnline: 'Visa i webbläsare',
    unsubscribe: 'Avsluta prenumeration',
  },

  auditConfirmation: {
    subject: 'Din GDPR-revisionsförfrågan har mottagits',
    preheader: 'Vi skannar din webbplats efter GDPR-efterlevnadsproblem',
    title: '🎯 Din revisionsförfrågan är bekräftad!',
    intro:
      'Tack för att du skickade in din webbplats för en GDPR-efterlevnadsrevision. Vi tar integritet på allvar och är här för att hjälpa.',
    websiteLabel: 'Webbplats',
    auditIdLabel: 'Revisions-ID',
    whatHappensNext: 'Vad händer nu?',
    step1: '🔍 Vår AI skannar din webbplats på 50+ efterlevnadskontrollpunkter',
    step2:
      '📊 Vi analyserar cookies, spårare, samtyckesbannrar och integritetspolicyer',
    step3: '📧 Du får din detaljerade efterlevnadsrapport via e-post',
    estimatedTime: 'Beräknad tid: 5-15 minuter',
    tipTitle: '💡 Proffstips',
    tipContent:
      'Medan du väntar, granska din nuvarande integritetspolicy. Är den uppdaterad? Förklarar den tydligt hur du samlar in och använder personuppgifter?',
  },

  auditResults: {
    subject: 'Din GDPR-revisionsrapport är klar',
    preheader: 'Din webbplats efterlevnadspoäng och rekommendationer är klara',
    title: '📊 Din GDPR-efterlevnadsrapport',
    intro:
      'Goda nyheter! Din webbplatsrevision är klar. Här är en sammanfattning av din GDPR-efterlevnadsstatus.',
    scoreLabel: 'Efterlevnadspoäng',
    scoreExcellent: 'Utmärkt',
    scoreGood: 'Bra',
    scoreNeedsImprovement: 'Behöver förbättras',
    scoreCritical: 'Kritisk',
    summaryTitle: 'Sammanfattning',
    issuesFound: 'Hittade problem',
    passedChecks: 'Godkända kontroller',
    viewFullReport: 'Visa fullständig rapport',
    topIssuesTitle: 'Prioriterade problem',
    upgradeTitle: '🚀 Lås upp din fullständiga rapport',
    upgradeDescription:
      'Få detaljerade åtgärdssteg, kodavsnitt och en prioriterad handlingsplan för att bli helt GDPR-kompatibel.',
    upgradeButton: 'Hämta fullständig rapport',
    freeReportNote:
      'Detta är din gratis sammanfattningsrapport. Uppgradera för att få tillgång till den fullständiga analysen med handlingsbara rekommendationer.',
  },

  paymentConfirmation: {
    subject: 'Betalning bekräftad - Fullständig GDPR-rapport upplåst',
    preheader:
      'Din betalning lyckades. Få tillgång till din fullständiga rapport nu.',
    title: '✅ Betalning lyckades!',
    intro:
      'Tack för ditt köp! Din fullständiga GDPR-efterlevnadsrapport är nu upplåst och redo att visas.',
    orderDetails: 'Orderdetaljer',
    productLabel: 'Produkt',
    productName: 'Fullständig GDPR-efterlevnadsrapport',
    amountLabel: 'Belopp',
    dateLabel: 'Datum',
    invoiceNote: 'Ett kvitto har skickats till din e-postadress.',
    accessReport: 'Få tillgång till din fullständiga rapport',
    supportNote:
      'Behöver du hjälp med att förstå din rapport? Vårt team finns här för att hjälpa.',
  },

  adminNotification: {
    subject: 'Ny revisionsförfrågan',
    newRequest: 'Ny revisionsförfrågan mottagen',
    details: 'Förfrågningsdetaljer',
    marketingOptIn: 'Marknadsföringssamtycke',
    yes: 'Ja',
    no: 'Nej',
  },
};
