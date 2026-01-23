import { EmailTranslations } from '../types';

export const et: EmailTranslations = {
  common: {
    greeting: 'Tere',
    thankYou: 'Täname, et valisite PolicyTrackeri!',
    bestRegards: 'Parimate soovidega',
    team: 'PolicyTrackeri meeskond',
    questionsContact:
      'Kas teil on küsimusi? Vastake sellele e-kirjale või võtke meiega ühendust aadressil hello@policytracker.eu',
    automatedMessage: 'See on automaatne sõnum. Palun ärge vastake otse.',
    viewOnline: 'Vaata brauseris',
    unsubscribe: 'Loobu tellimusest',
  },

  auditConfirmation: {
    subject: 'Teie GDPR-auditi taotlus on vastu võetud',
    preheader: 'Skannime teie veebisaiti GDPR-vastavuse probleemide leidmiseks',
    title: '🎯 Teie auditi taotlus on kinnitatud!',
    intro:
      'Täname, et esitasite oma veebisaidi GDPR-vastavuse auditiks. Võtame privaatsust tõsiselt ja oleme siin, et aidata.',
    websiteLabel: 'Veebisait',
    auditIdLabel: 'Auditi ID',
    whatHappensNext: 'Mis järgmiseks?',
    step1:
      '🔍 Meie AI skannib teie veebisaiti üle 50 vastavuse kontrollpunkti osas',
    step2:
      '📊 Analüüsime küpsiseid, jälgijaid, nõusoleku ribasid ja privaatsuspoliitikaid',
    step3: '📧 Saate oma üksikasjaliku vastavusaruande e-postiga',
    estimatedTime: 'Eeldatav aeg: 5-15 minutit',
    tipTitle: '💡 Nõuanne',
    tipContent:
      'Oodates vaadake üle oma praegune privaatsuspoliitika. Kas see on ajakohane? Kas see selgitab selgelt, kuidas te isikuandmeid kogute ja kasutate?',
  },

  auditResults: {
    subject: 'Teie GDPR-auditi aruanne on valmis',
    preheader: 'Teie veebisaidi vastavuse skoor ja soovitused on valmis',
    title: '📊 Teie GDPR-vastavuse aruanne',
    intro:
      'Suurepärased uudised! Teie veebisaidi audit on lõpetatud. Siin on kokkuvõte teie GDPR-vastavuse staatusest.',
    scoreLabel: 'Vastavuse skoor',
    scoreExcellent: 'Suurepärane',
    scoreGood: 'Hea',
    scoreNeedsImprovement: 'Vajab parandamist',
    scoreCritical: 'Kriitiline',
    summaryTitle: 'Kokkuvõte',
    issuesFound: 'Leitud probleemid',
    passedChecks: 'Läbitud kontrollid',
    viewFullReport: 'Vaata täisaruannet',
    topIssuesTitle: 'Prioriteetsed probleemid',
    upgradeTitle: '🚀 Avage oma täisaruanne',
    upgradeDescription:
      'Saate üksikasjalikud parandussammud, koodilõigud ja prioriteetne tegevuskava täieliku GDPR-vastavuse saavutamiseks.',
    upgradeButton: 'Hangi täisaruanne',
    freeReportNote:
      'See on teie tasuta kokkuvõttev aruanne. Uuendage, et pääseda ligi täielikule analüüsile koos rakendatavate soovitustega.',
  },

  paymentConfirmation: {
    subject: 'Makse kinnitatud - Täielik GDPR-aruanne avatud',
    preheader: 'Teie makse õnnestus. Pääsege nüüd oma täisaruandele ligi.',
    title: '✅ Makse õnnestus!',
    intro:
      'Täname ostu eest! Teie täielik GDPR-vastavuse aruanne on nüüd avatud ja vaatamiseks valmis.',
    orderDetails: 'Tellimuse üksikasjad',
    productLabel: 'Toode',
    productName: 'Täielik GDPR-vastavuse aruanne',
    amountLabel: 'Summa',
    dateLabel: 'Kuupäev',
    invoiceNote: 'Kviitung on saadetud teie e-posti aadressile.',
    accessReport: 'Ligipääs täisaruandele',
    supportNote:
      'Vajate abi aruande mõistmisel? Meie meeskond on siin, et aidata.',
  },

  adminNotification: {
    subject: 'Uus auditi taotlus',
    newRequest: 'Uus auditi taotlus vastu võetud',
    details: 'Taotluse üksikasjad',
    marketingOptIn: 'Turunduse nõusolek',
    yes: 'Jah',
    no: 'Ei',
  },
};
