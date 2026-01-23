import { EmailTranslations } from '../types';

export const lt: EmailTranslations = {
  common: {
    greeting: 'Sveiki',
    thankYou: 'Dėkojame, kad pasirinkote PolicyTracker!',
    bestRegards: 'Pagarbiai',
    team: 'PolicyTracker komanda',
    questionsContact:
      'Turite klausimų? Atsakykite į šį el. laišką arba susisiekite su mumis hello@policytracker.eu',
    automatedMessage:
      'Tai yra automatinis pranešimas. Prašome neatsakyti tiesiogiai.',
    viewOnline: 'Peržiūrėti naršyklėje',
    unsubscribe: 'Atsisakyti prenumeratos',
  },

  auditConfirmation: {
    subject: 'Jūsų BDAR audito užklausa gauta',
    preheader: 'Skenuojame jūsų svetainę dėl BDAR atitikties problemų',
    title: '🎯 Jūsų audito užklausa patvirtinta!',
    intro:
      'Dėkojame, kad pateikėte savo svetainę BDAR atitikties auditui. Rimtai žiūrime į privatumą ir esame čia, kad padėtume.',
    websiteLabel: 'Svetainė',
    auditIdLabel: 'Audito ID',
    whatHappensNext: 'Kas toliau?',
    step1:
      '🔍 Mūsų DI skenuoja jūsų svetainę pagal daugiau nei 50 atitikties patikros taškų',
    step2:
      '📊 Analizuojame slapukus, sekiklius, sutikimo juostas ir privatumo politikas',
    step3: '📧 Gausite išsamią atitikties ataskaitą el. paštu',
    estimatedTime: 'Numatomas laikas: 5-15 minučių',
    tipTitle: '💡 Patarimas',
    tipContent:
      'Kol laukiate, peržiūrėkite savo dabartinę privatumo politiką. Ar ji atnaujinta? Ar ji aiškiai paaiškina, kaip renkate ir naudojate asmens duomenis?',
  },

  auditResults: {
    subject: 'Jūsų BDAR audito ataskaita paruošta',
    preheader: 'Jūsų svetainės atitikties balas ir rekomendacijos paruoštos',
    title: '📊 Jūsų BDAR atitikties ataskaita',
    intro:
      'Puikios naujienos! Jūsų svetainės auditas baigtas. Štai jūsų BDAR atitikties būsenos santrauka.',
    scoreLabel: 'Atitikties balas',
    scoreExcellent: 'Puikus',
    scoreGood: 'Geras',
    scoreNeedsImprovement: 'Reikia tobulinti',
    scoreCritical: 'Kritinis',
    summaryTitle: 'Santrauka',
    issuesFound: 'Rastos problemos',
    passedChecks: 'Praėję patikrinimai',
    viewFullReport: 'Peržiūrėti pilną ataskaitą',
    topIssuesTitle: 'Prioritetinės problemos',
    upgradeTitle: '🚀 Atrakinkite pilną ataskaitą',
    upgradeDescription:
      'Gaukite išsamius taisymo žingsnius, kodo fragmentus ir prioritetinį veiksmų planą pilnai BDAR atitikčiai pasiekti.',
    upgradeButton: 'Gauti pilną ataskaitą',
    freeReportNote:
      'Tai yra jūsų nemokama santraukos ataskaita. Atnaujinkite, kad gautumėte prieigą prie pilnos analizės su veiksmingomis rekomendacijomis.',
  },

  paymentConfirmation: {
    subject: 'Mokėjimas patvirtintas - Pilna BDAR ataskaita atrakinta',
    preheader:
      'Jūsų mokėjimas sėkmingas. Gaukite prieigą prie pilnos ataskaitos dabar.',
    title: '✅ Sėkmingas mokėjimas!',
    intro:
      'Dėkojame už pirkimą! Jūsų pilna BDAR atitikties ataskaita dabar atrakinta ir paruošta peržiūrai.',
    orderDetails: 'Užsakymo informacija',
    productLabel: 'Produktas',
    productName: 'Pilna BDAR atitikties ataskaita',
    amountLabel: 'Suma',
    dateLabel: 'Data',
    invoiceNote: 'Kvitas išsiųstas į jūsų el. pašto adresą.',
    accessReport: 'Prieiga prie pilnos ataskaitos',
    supportNote:
      'Reikia pagalbos suprantant ataskaitą? Mūsų komanda yra čia, kad padėtų.',
  },

  adminNotification: {
    subject: 'Nauja audito užklausa',
    newRequest: 'Gauta nauja audito užklausa',
    details: 'Užklausos informacija',
    marketingOptIn: 'Rinkodaros sutikimas',
    yes: 'Taip',
    no: 'Ne',
  },
};
