import { EmailTranslations } from '../types';

export const lv: EmailTranslations = {
  common: {
    greeting: 'Sveiki',
    thankYou: 'Paldies, ka izvēlējāties PolicyTracker!',
    bestRegards: 'Ar cieņu',
    team: 'PolicyTracker komanda',
    questionsContact:
      'Vai jums ir jautājumi? Atbildiet uz šo e-pastu vai sazinieties ar mums hello@policytracker.eu',
    automatedMessage: 'Šis ir automātisks ziņojums. Lūdzu, neatbildiet tieši.',
    viewOnline: 'Skatīt pārlūkprogrammā',
    unsubscribe: 'Atrakstīties',
  },

  auditConfirmation: {
    subject: 'Jūsu GDPR audita pieprasījums ir saņemts',
    preheader:
      'Mēs skenējam jūsu vietni, lai atrastu GDPR atbilstības problēmas',
    title: '🎯 Jūsu audita pieprasījums ir apstiprināts!',
    intro:
      'Paldies, ka iesniedzāt savu vietni GDPR atbilstības auditam. Mēs nopietni attiecamies pret privātumu un esam šeit, lai palīdzētu.',
    websiteLabel: 'Vietne',
    auditIdLabel: 'Audita ID',
    whatHappensNext: 'Kas notiek tālāk?',
    step1:
      '🔍 Mūsu AI skenē jūsu vietni vairāk nekā 50 atbilstības kontrolpunktos',
    step2:
      '📊 Mēs analizējam sīkdatnes, izsekotājus, piekrišanas banerus un konfidencialitātes politikas',
    step3: '📧 Jūs saņemsiet detalizētu atbilstības ziņojumu pa e-pastu',
    estimatedTime: 'Paredzamais laiks: 5-15 minūtes',
    tipTitle: '💡 Padoms',
    tipContent:
      'Kamēr gaidāt, pārskatiet savu pašreizējo konfidencialitātes politiku. Vai tā ir aktuāla? Vai tā skaidri izskaidro, kā jūs vācat un izmantojat personas datus?',
  },

  auditResults: {
    subject: 'Jūsu GDPR audita ziņojums ir gatavs',
    preheader: 'Jūsu vietnes atbilstības rezultāts un ieteikumi ir gatavi',
    title: '📊 Jūsu GDPR atbilstības ziņojums',
    intro:
      'Labas ziņas! Jūsu vietnes audits ir pabeigts. Šeit ir jūsu GDPR atbilstības statusa kopsavilkums.',
    scoreLabel: 'Atbilstības rezultāts',
    scoreExcellent: 'Izcili',
    scoreGood: 'Labi',
    scoreNeedsImprovement: 'Nepieciešami uzlabojumi',
    scoreCritical: 'Kritisks',
    summaryTitle: 'Kopsavilkums',
    issuesFound: 'Atrastās problēmas',
    passedChecks: 'Izturētās pārbaudes',
    viewFullReport: 'Skatīt pilnu ziņojumu',
    topIssuesTitle: 'Prioritārās problēmas',
    upgradeTitle: '🚀 Atbloķējiet pilnu ziņojumu',
    upgradeDescription:
      'Iegūstiet detalizētus labošanas soļus, koda fragmentus un prioritizētu rīcības plānu pilnīgas GDPR atbilstības sasniegšanai.',
    upgradeButton: 'Iegūt pilnu ziņojumu',
    freeReportNote:
      'Šis ir jūsu bezmaksas kopsavilkuma ziņojums. Uzlabojiet, lai piekļūtu pilnai analīzei ar praktiskiem ieteikumiem.',
  },

  paymentConfirmation: {
    subject: 'Maksājums apstiprināts - Pilns GDPR ziņojums atbloķēts',
    preheader:
      'Jūsu maksājums bija veiksmīgs. Piekļūstiet pilnam ziņojumam tagad.',
    title: '✅ Veiksmīgs maksājums!',
    intro:
      'Paldies par pirkumu! Jūsu pilnais GDPR atbilstības ziņojums tagad ir atbloķēts un gatavs apskatei.',
    orderDetails: 'Pasūtījuma informācija',
    productLabel: 'Produkts',
    productName: 'Pilns GDPR atbilstības ziņojums',
    amountLabel: 'Summa',
    dateLabel: 'Datums',
    invoiceNote: 'Kvīts ir nosūtīta uz jūsu e-pasta adresi.',
    accessReport: 'Piekļūt pilnam ziņojumam',
    supportNote:
      'Nepieciešama palīdzība ziņojuma izpratnē? Mūsu komanda ir šeit, lai palīdzētu.',
  },

  adminNotification: {
    subject: 'Jauns audita pieprasījums',
    newRequest: 'Saņemts jauns audita pieprasījums',
    details: 'Pieprasījuma informācija',
    marketingOptIn: 'Mārketinga piekrišana',
    yes: 'Jā',
    no: 'Nē',
  },
};
