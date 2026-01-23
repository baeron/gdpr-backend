import { EmailTranslations } from '../types';

export const sl: EmailTranslations = {
  common: {
    greeting: 'Pozdravljeni',
    thankYou: 'Hvala, da ste izbrali PolicyTracker!',
    bestRegards: 'S spoštovanjem',
    team: 'Ekipa PolicyTracker',
    questionsContact:
      'Imate vprašanja? Odgovorite na to e-pošto ali nas kontaktirajte na hello@policytracker.eu',
    automatedMessage:
      'To je samodejno sporočilo. Prosimo, ne odgovarjajte neposredno.',
    viewOnline: 'Poglej v brskalniku',
    unsubscribe: 'Odjava',
  },

  auditConfirmation: {
    subject: 'Vaša zahteva za revizijo GDPR je bila prejeta',
    preheader: 'Pregledujemo vašo spletno stran za težave s skladnostjo GDPR',
    title: '🎯 Vaša zahteva za revizijo je potrjena!',
    intro:
      'Hvala, da ste oddali svojo spletno stran za revizijo skladnosti z GDPR. Zasebnost jemljemo resno in smo tu, da pomagamo.',
    websiteLabel: 'Spletna stran',
    auditIdLabel: 'ID revizije',
    whatHappensNext: 'Kaj sledi?',
    step1:
      '🔍 Naša umetna inteligenca pregleda vašo spletno stran na več kot 50 kontrolnih točkah',
    step2:
      '📊 Analiziramo piškotke, sledilce, pasice za soglasje in pravilnike o zasebnosti',
    step3: '📧 Po e-pošti boste prejeli podrobno poročilo o skladnosti',
    estimatedTime: 'Predviden čas: 5-15 minut',
    tipTitle: '💡 Namig',
    tipContent:
      'Med čakanjem preglejte svoj trenutni pravilnik o zasebnosti. Je posodobljen? Ali jasno pojasnjuje, kako zbirate in uporabljate osebne podatke?',
  },

  auditResults: {
    subject: 'Vaše poročilo o reviziji GDPR je pripravljeno',
    preheader:
      'Ocena skladnosti vaše spletne strani in priporočila so pripravljena',
    title: '📊 Vaše poročilo o skladnosti z GDPR',
    intro:
      'Odlične novice! Revizija vaše spletne strani je zaključena. Tukaj je povzetek vašega stanja skladnosti z GDPR.',
    scoreLabel: 'Ocena skladnosti',
    scoreExcellent: 'Odlično',
    scoreGood: 'Dobro',
    scoreNeedsImprovement: 'Potrebne izboljšave',
    scoreCritical: 'Kritično',
    summaryTitle: 'Povzetek',
    issuesFound: 'Najdene težave',
    passedChecks: 'Uspešni pregledi',
    viewFullReport: 'Poglej celotno poročilo',
    topIssuesTitle: 'Prednostne težave',
    upgradeTitle: '🚀 Odklenite celotno poročilo',
    upgradeDescription:
      'Pridobite podrobne korake za odpravo, delčke kode in prioritetni akcijski načrt za doseganje popolne skladnosti z GDPR.',
    upgradeButton: 'Pridobi celotno poročilo',
    freeReportNote:
      'To je vaše brezplačno povzetek poročilo. Nadgradite za dostop do celotne analize z izvedljivimi priporočili.',
  },

  paymentConfirmation: {
    subject: 'Plačilo potrjeno - Celotno poročilo GDPR odklenjeno',
    preheader:
      'Vaše plačilo je bilo uspešno. Dostopajte do celotnega poročila zdaj.',
    title: '✅ Uspešno plačilo!',
    intro:
      'Hvala za nakup! Vaše celotno poročilo o skladnosti z GDPR je zdaj odklenjeno in pripravljeno za ogled.',
    orderDetails: 'Podrobnosti naročila',
    productLabel: 'Izdelek',
    productName: 'Celotno poročilo o skladnosti z GDPR',
    amountLabel: 'Znesek',
    dateLabel: 'Datum',
    invoiceNote: 'Potrdilo je bilo poslano na vaš e-poštni naslov.',
    accessReport: 'Dostop do celotnega poročila',
    supportNote:
      'Potrebujete pomoč pri razumevanju poročila? Naša ekipa je tu, da pomaga.',
  },

  adminNotification: {
    subject: 'Nova zahteva za revizijo',
    newRequest: 'Prejeta nova zahteva za revizijo',
    details: 'Podrobnosti zahteve',
    marketingOptIn: 'Soglasje za trženje',
    yes: 'Da',
    no: 'Ne',
  },
};
