import { EmailTranslations } from '../types';

export const mt: EmailTranslations = {
  common: {
    greeting: 'Bongu',
    thankYou: 'Grazzi talli għażilt PolicyTracker!',
    bestRegards: 'Bl-aħjar xewqat',
    team: "It-Tim ta' PolicyTracker",
    questionsContact:
      'Għandek mistoqsijiet? Wieġeb għal din l-email jew ikkuntattjana fuq hello@policytracker.eu',
    automatedMessage:
      'Dan huwa messaġġ awtomatiku. Jekk jogħġbok, tawieġebx direttament.',
    viewOnline: 'Ara fil-browser',
    unsubscribe: 'Neħħi l-abbonament',
  },

  auditConfirmation: {
    subject: 'It-talba tiegħek għall-awditjar tal-GDPR waslet',
    preheader:
      "Qed niskennjaw il-websajt tiegħek għal problemi ta' konformità mal-GDPR",
    title: '🎯 It-talba tiegħek għall-awditjar ġiet ikkonfermata!',
    intro:
      "Grazzi talli bagħat il-websajt tiegħek għal awditjar ta' konformità mal-GDPR. Nieħdu l-privatezza bis-serjetà u aħna hawn biex ngħinu.",
    websiteLabel: 'Websajt',
    auditIdLabel: 'ID tal-Awditjar',
    whatHappensNext: "X'jiġri wara?",
    step1:
      "🔍 L-AI tagħna jiskennija l-websajt tiegħek fuq aktar minn 50 punt ta' kontroll",
    step2:
      '📊 Nanalizzaw il-cookies, it-trackers, il-banners tal-kunsens u l-politiki tal-privatezza',
    step3: '📧 Tirċievi r-rapport dettaljat tal-konformità bl-email',
    estimatedTime: 'Ħin stmat: 5-15 minuta',
    tipTitle: '💡 Parir',
    tipContent:
      "Waqt li qed tistenna, irrevedi l-politika tal-privatezza attwali tiegħek. Hija aġġornata? Tispjega b'mod ċar kif tiġbor u tuża d-data personali?",
  },

  auditResults: {
    subject: 'Ir-rapport tal-awditjar tal-GDPR tiegħek huwa lest',
    preheader:
      'L-iskor tal-konformità tal-websajt tiegħek u r-rakkomandazzjonijiet huma lesti',
    title: '📊 Ir-rapport tal-konformità tal-GDPR tiegħek',
    intro:
      'Aħbar tajba! L-awditjar tal-websajt tiegħek huwa komplut. Hawn hemm sommarju tal-istatus tal-konformità tal-GDPR tiegħek.',
    scoreLabel: 'Iskor tal-konformità',
    scoreExcellent: 'Eċċellenti',
    scoreGood: 'Tajjeb',
    scoreNeedsImprovement: 'Jeħtieġ titjib',
    scoreCritical: 'Kritiku',
    summaryTitle: 'Sommarju',
    issuesFound: 'Problemi misjuba',
    passedChecks: 'Kontrolli li għaddew',
    viewFullReport: 'Ara r-rapport sħiħ',
    topIssuesTitle: "Problemi ta' prijorità",
    upgradeTitle: '🚀 Iftaħ ir-rapport sħiħ tiegħek',
    upgradeDescription:
      "Ikseb passi dettaljati ta' rimedju, snippets ta' kodiċi u pjan ta' azzjoni prijoritizzat biex issir kompletament konformi mal-GDPR.",
    upgradeButton: 'Ikseb ir-rapport sħiħ',
    freeReportNote:
      "Dan huwa r-rapport tas-sommarju b'xejn tiegħek. Aġġorna biex taċċessa l-analiżi kompluta b'rakkomandazzjonijiet azzjonabbli.",
  },

  paymentConfirmation: {
    subject: 'Ħlas ikkonfermat - Rapport sħiħ tal-GDPR miftuħ',
    preheader:
      "Il-ħlas tiegħek kien ta' suċċess. Aċċessa r-rapport sħiħ tiegħek issa.",
    title: "✅ Ħlas ta' suċċess!",
    intro:
      'Grazzi għax-xiri tiegħek! Ir-rapport sħiħ tal-konformità tal-GDPR tiegħek issa huwa miftuħ u lest biex tara.',
    orderDetails: 'Dettalji tal-ordni',
    productLabel: 'Prodott',
    productName: 'Rapport sħiħ tal-konformità tal-GDPR',
    amountLabel: 'Ammont',
    dateLabel: 'Data',
    invoiceNote: 'Irċevuta ntbagħtet lill-indirizz tal-email tiegħek.',
    accessReport: 'Aċċessa r-rapport sħiħ tiegħek',
    supportNote:
      'Għandek bżonn għajnuna biex tifhem ir-rapport tiegħek? It-tim tagħna huwa hawn biex jgħinek.',
  },

  adminNotification: {
    subject: 'Talba ġdida għall-awditjar',
    newRequest: 'Talba ġdida għall-awditjar waslet',
    details: 'Dettalji tat-talba',
    marketingOptIn: 'Kunsens tal-marketing',
    yes: 'Iva',
    no: 'Le',
  },
};
