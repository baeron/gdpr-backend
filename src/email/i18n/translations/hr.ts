import { EmailTranslations } from '../types';

export const hr: EmailTranslations = {
  common: {
    greeting: 'Pozdrav',
    thankYou: 'Hvala što ste odabrali PolicyTracker!',
    bestRegards: 'S poštovanjem',
    team: 'Tim PolicyTracker',
    questionsContact:
      'Imate pitanja? Odgovorite na ovaj e-mail ili nas kontaktirajte na hello@policytracker.eu',
    automatedMessage:
      'Ovo je automatska poruka. Molimo ne odgovarajte izravno.',
    viewOnline: 'Pogledaj u pregledniku',
    unsubscribe: 'Odjava',
  },

  auditConfirmation: {
    subject: 'Vaš zahtjev za GDPR reviziju je primljen',
    preheader: 'Skeniramo vašu web stranicu za probleme usklađenosti s GDPR-om',
    title: '🎯 Vaš zahtjev za reviziju je potvrđen!',
    intro:
      'Hvala što ste poslali svoju web stranicu na reviziju usklađenosti s GDPR-om. Ozbiljno shvaćamo privatnost i tu smo da pomognemo.',
    websiteLabel: 'Web stranica',
    auditIdLabel: 'ID revizije',
    whatHappensNext: 'Što slijedi?',
    step1:
      '🔍 Naša AI skenira vašu web stranicu na više od 50 kontrolnih točaka usklađenosti',
    step2:
      '📊 Analiziramo kolačiće, pratitelje, bannere pristanka i politike privatnosti',
    step3: '📧 Primit ćete detaljno izvješće o usklađenosti putem e-pošte',
    estimatedTime: 'Procijenjeno vrijeme: 5-15 minuta',
    tipTitle: '💡 Savjet',
    tipContent:
      'Dok čekate, pregledajte svoju trenutnu politiku privatnosti. Je li ažurirana? Jasno li objašnjava kako prikupljate i koristite osobne podatke?',
  },

  auditResults: {
    subject: 'Vaše izvješće o GDPR reviziji je spremno',
    preheader: 'Rezultat usklađenosti vaše web stranice i preporuke su spremni',
    title: '📊 Vaše izvješće o usklađenosti s GDPR-om',
    intro:
      'Sjajne vijesti! Revizija vaše web stranice je završena. Ovdje je sažetak vašeg statusa usklađenosti s GDPR-om.',
    scoreLabel: 'Rezultat usklađenosti',
    scoreExcellent: 'Izvrsno',
    scoreGood: 'Dobro',
    scoreNeedsImprovement: 'Potrebno poboljšanje',
    scoreCritical: 'Kritično',
    summaryTitle: 'Sažetak',
    issuesFound: 'Pronađeni problemi',
    passedChecks: 'Uspješne provjere',
    viewFullReport: 'Pogledaj cijelo izvješće',
    topIssuesTitle: 'Prioritetni problemi',
    upgradeTitle: '🚀 Otključajte cijelo izvješće',
    upgradeDescription:
      'Dobijte detaljne korake za ispravljanje, isječke koda i prioritetni akcijski plan za postizanje pune usklađenosti s GDPR-om.',
    upgradeButton: 'Dobij cijelo izvješće',
    freeReportNote:
      'Ovo je vaše besplatno sažeto izvješće. Nadogradite za pristup cjelokupnoj analizi s primjenjivim preporukama.',
  },

  paymentConfirmation: {
    subject: 'Plaćanje potvrđeno - Cijelo GDPR izvješće otključano',
    preheader: 'Vaše plaćanje je uspješno. Pristupite cijelom izvješću sada.',
    title: '✅ Uspješno plaćanje!',
    intro:
      'Hvala na kupnji! Vaše cijelo izvješće o usklađenosti s GDPR-om sada je otključano i spremno za pregled.',
    orderDetails: 'Detalji narudžbe',
    productLabel: 'Proizvod',
    productName: 'Cijelo izvješće o usklađenosti s GDPR-om',
    amountLabel: 'Iznos',
    dateLabel: 'Datum',
    invoiceNote: 'Račun je poslan na vašu e-mail adresu.',
    accessReport: 'Pristup cijelom izvješću',
    supportNote:
      'Trebate pomoć u razumijevanju izvješća? Naš tim je tu da pomogne.',
  },

  adminNotification: {
    subject: 'Novi zahtjev za reviziju',
    newRequest: 'Primljen novi zahtjev za reviziju',
    details: 'Detalji zahtjeva',
    marketingOptIn: 'Marketinška suglasnost',
    yes: 'Da',
    no: 'Ne',
  },
};
