import { EmailTranslations } from '../types';

export const ga: EmailTranslations = {
  common: {
    greeting: 'Dia duit',
    thankYou: 'Go raibh maith agat as PolicyTracker a roghnú!',
    bestRegards: 'Le meas',
    team: 'Foireann PolicyTracker',
    questionsContact:
      'An bhfuil ceisteanna agat? Freagair an ríomhphost seo nó déan teagmháil linn ag hello@policytracker.eu',
    automatedMessage:
      'Is teachtaireacht uathoibríoch é seo. Ná freagair go díreach le do thoil.',
    viewOnline: 'Féach sa bhrabhsálaí',
    unsubscribe: 'Díliostáil',
  },

  auditConfirmation: {
    subject: "Fuarthas d'iarratas ar iniúchadh GDPR",
    preheader:
      'Táimid ag scanadh do shuíomh gréasáin le haghaidh fadhbanna comhlíonta GDPR',
    title: "🎯 Tá d'iarratas ar iniúchadh deimhnithe!",
    intro:
      'Go raibh maith agat as do shuíomh gréasáin a chur isteach le haghaidh iniúchadh comhlíonta GDPR. Glacaimid le príobháideachas go dáiríre agus táimid anseo chun cabhrú.',
    websiteLabel: 'Suíomh Gréasáin',
    auditIdLabel: 'ID Iniúchta',
    whatHappensNext: 'Cad a tharlóidh ansin?',
    step1:
      '🔍 Scanann ár AI do shuíomh gréasáin ar bhreis agus 50 pointe seiceála comhlíonta',
    step2:
      '📊 Déanaimid anailís ar fhianáin, rianairí, meirgí toilithe agus polasaithe príobháideachais',
    step3:
      '📧 Gheobhaidh tú do thuairisc mhionsonraithe comhlíonta trí ríomhphost',
    estimatedTime: 'Am measta: 5-15 nóiméad',
    tipTitle: '💡 Leid',
    tipContent:
      'Agus tú ag fanacht, athbhreithnigh do pholasaí príobháideachais reatha. An bhfuil sé cothrom le dáta? An míníonn sé go soiléir conas a bhailíonn tú agus a úsáideann tú sonraí pearsanta?',
  },

  auditResults: {
    subject: 'Tá do thuairisc iniúchta GDPR réidh',
    preheader: 'Tá scór comhlíonta do shuímh gréasáin agus moltaí réidh',
    title: '📊 Do Thuairisc Chomhlíonta GDPR',
    intro:
      'Dea-scéala! Tá iniúchadh do shuímh gréasáin críochnaithe. Seo achoimre ar do stádas comhlíonta GDPR.',
    scoreLabel: 'Scór Comhlíonta',
    scoreExcellent: 'Ar fheabhas',
    scoreGood: 'Maith',
    scoreNeedsImprovement: 'Feabhsú de dhíth',
    scoreCritical: 'Criticiúil',
    summaryTitle: 'Achoimre',
    issuesFound: 'Fadhbanna a aimsíodh',
    passedChecks: "Seiceálacha a d'éirigh leo",
    viewFullReport: 'Féach ar an tuairisc iomlán',
    topIssuesTitle: 'Fadhbanna Tosaíochta',
    upgradeTitle: '🚀 Díghlasáil do thuairisc iomlán',
    upgradeDescription:
      'Faigh céimeanna mionsonraithe ceartúcháin, blúirí cóid agus plean gníomhaíochta tosaíochta chun comhlíonadh iomlán GDPR a bhaint amach.',
    upgradeButton: 'Faigh tuairisc iomlán',
    freeReportNote:
      'Is é seo do thuairisc achomair saor in aisce. Uasghrádaigh chun rochtain a fháil ar an anailís iomlán le moltaí inghníomhaithe.',
  },

  paymentConfirmation: {
    subject: 'Íocaíocht deimhnithe - Tuairisc iomlán GDPR díghlasáilte',
    preheader:
      "D'éirigh le d'íocaíocht. Faigh rochtain ar do thuairisc iomlán anois.",
    title: "✅ D'éirigh leis an íocaíocht!",
    intro:
      'Go raibh maith agat as do cheannach! Tá do thuairisc iomlán comhlíonta GDPR díghlasáilte anois agus réidh le féachaint.',
    orderDetails: 'Sonraí Ordaithe',
    productLabel: 'Táirge',
    productName: 'Tuairisc iomlán comhlíonta GDPR',
    amountLabel: 'Méid',
    dateLabel: 'Dáta',
    invoiceNote: 'Seoladh admháil chuig do sheoladh ríomhphoist.',
    accessReport: 'Rochtain ar do thuairisc iomlán',
    supportNote:
      'An bhfuil cabhair uait chun do thuairisc a thuiscint? Tá ár bhfoireann anseo chun cabhrú.',
  },

  adminNotification: {
    subject: 'Iarratas nua ar iniúchadh',
    newRequest: 'Fuarthas iarratas nua ar iniúchadh',
    details: 'Sonraí an iarratais',
    marketingOptIn: 'Toiliú margaíochta',
    yes: 'Tá',
    no: 'Níl',
  },
};
