import { EmailTranslations } from '../types';

export const nl: EmailTranslations = {
  common: {
    greeting: 'Hallo',
    thankYou: 'Bedankt dat u voor PolicyTracker heeft gekozen!',
    bestRegards: 'Met vriendelijke groet',
    team: 'Het PolicyTracker Team',
    questionsContact:
      'Vragen? Beantwoord deze e-mail of neem contact met ons op via hello@policytracker.eu',
    automatedMessage:
      'Dit is een automatisch bericht. Gelieve niet rechtstreeks te antwoorden.',
    viewOnline: 'Bekijk in browser',
    unsubscribe: 'Uitschrijven',
  },

  auditConfirmation: {
    subject: 'Uw AVG-auditaanvraag is ontvangen',
    preheader: 'We scannen uw website op AVG-nalevingsproblemen',
    title: '🎯 Uw auditaanvraag is bevestigd!',
    intro:
      'Bedankt voor het indienen van uw website voor een AVG-nalevingsaudit. We nemen privacy serieus en zijn hier om u te helpen.',
    websiteLabel: 'Website',
    auditIdLabel: 'Audit-ID',
    whatHappensNext: 'Wat gebeurt er nu?',
    step1: '🔍 Onze AI scant uw website op meer dan 50 nalevingscontrolepunten',
    step2:
      '📊 We analyseren cookies, trackers, toestemmingsbanners en privacybeleid',
    step3: '📧 U ontvangt uw gedetailleerde nalevingsrapport per e-mail',
    estimatedTime: 'Geschatte tijd: 5-15 minuten',
    tipTitle: '💡 Pro Tip',
    tipContent:
      'Bekijk terwijl u wacht uw huidige privacybeleid. Is het up-to-date? Legt het duidelijk uit hoe u persoonlijke gegevens verzamelt en gebruikt?',
  },

  auditResults: {
    subject: 'Uw AVG-auditrapport is klaar',
    preheader: 'Uw website nalevingsscore en aanbevelingen zijn klaar',
    title: '📊 Uw AVG-nalevingsrapport',
    intro:
      'Goed nieuws! Uw website-audit is voltooid. Hier is een samenvatting van uw AVG-nalevingsstatus.',
    scoreLabel: 'Nalevingsscore',
    scoreExcellent: 'Uitstekend',
    scoreGood: 'Goed',
    scoreNeedsImprovement: 'Verbetering nodig',
    scoreCritical: 'Kritiek',
    summaryTitle: 'Samenvatting',
    issuesFound: 'Gevonden problemen',
    passedChecks: 'Geslaagde controles',
    viewFullReport: 'Bekijk volledig rapport',
    topIssuesTitle: 'Prioriteitsproblemen',
    upgradeTitle: '🚀 Ontgrendel uw volledige rapport',
    upgradeDescription:
      'Krijg gedetailleerde herstelstappen, codefragmenten en een geprioriteerd actieplan om volledig AVG-conform te worden.',
    upgradeButton: 'Volledig rapport krijgen',
    freeReportNote:
      'Dit is uw gratis samenvattingsrapport. Upgrade om toegang te krijgen tot de volledige analyse met uitvoerbare aanbevelingen.',
  },

  paymentConfirmation: {
    subject: 'Betaling bevestigd - Volledig AVG-rapport ontgrendeld',
    preheader:
      'Uw betaling was succesvol. Krijg nu toegang tot uw volledige rapport.',
    title: '✅ Betaling geslaagd!',
    intro:
      'Bedankt voor uw aankoop! Uw volledige AVG-nalevingsrapport is nu ontgrendeld en klaar om te bekijken.',
    orderDetails: 'Bestelgegevens',
    productLabel: 'Product',
    productName: 'Volledig AVG-nalevingsrapport',
    amountLabel: 'Bedrag',
    dateLabel: 'Datum',
    invoiceNote: 'Een ontvangstbewijs is naar uw e-mailadres verzonden.',
    accessReport: 'Toegang tot uw volledige rapport',
    supportNote:
      'Hulp nodig bij het begrijpen van uw rapport? Ons team staat klaar om u te helpen.',
  },

  adminNotification: {
    subject: 'Nieuwe auditaanvraag',
    newRequest: 'Nieuwe auditaanvraag ontvangen',
    details: 'Aanvraagdetails',
    marketingOptIn: 'Marketing opt-in',
    yes: 'Ja',
    no: 'Nee',
  },
};
