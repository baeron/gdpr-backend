import { EmailTranslations } from '../types';

export const hu: EmailTranslations = {
  common: {
    greeting: 'Üdvözöljük',
    thankYou: 'Köszönjük, hogy a PolicyTracker-t választotta!',
    bestRegards: 'Üdvözlettel',
    team: 'A PolicyTracker Csapat',
    questionsContact:
      'Kérdései vannak? Válaszoljon erre az e-mailre vagy írjon nekünk: hello@policytracker.eu',
    automatedMessage:
      'Ez egy automatikus üzenet. Kérjük, ne válaszoljon közvetlenül.',
    viewOnline: 'Megtekintés böngészőben',
    unsubscribe: 'Leiratkozás',
  },

  auditConfirmation: {
    subject: 'GDPR audit kérelme beérkezett',
    preheader:
      'Ellenőrizzük weboldalát a GDPR megfelelőségi problémák szempontjából',
    title: '🎯 Audit kérelme megerősítve!',
    intro:
      'Köszönjük, hogy beküldte weboldalát GDPR megfelelőségi auditra. Komolyan vesszük az adatvédelmet, és itt vagyunk, hogy segítsünk.',
    websiteLabel: 'Weboldal',
    auditIdLabel: 'Audit azonosító',
    whatHappensNext: 'Mi történik ezután?',
    step1:
      '🔍 MI-nk több mint 50 megfelelőségi ellenőrzési ponton vizsgálja weboldalát',
    step2:
      '📊 Elemezzük a sütiket, nyomkövetőket, hozzájárulási bannereket és adatvédelmi irányelveket',
    step3: '📧 Részletes megfelelőségi jelentést kap e-mailben',
    estimatedTime: 'Becsült idő: 5-15 perc',
    tipTitle: '💡 Tipp',
    tipContent:
      'Amíg vár, tekintse át jelenlegi adatvédelmi irányelveit. Naprakész? Világosan elmagyarázza, hogyan gyűjti és használja fel a személyes adatokat?',
  },

  auditResults: {
    subject: 'GDPR audit jelentése elkészült',
    preheader: 'Weboldala megfelelőségi pontszáma és ajánlásai készen állnak',
    title: '📊 GDPR megfelelőségi jelentése',
    intro:
      'Nagyszerű hírek! Weboldala auditja befejeződött. Íme a GDPR megfelelőségi állapotának összefoglalója.',
    scoreLabel: 'Megfelelőségi pontszám',
    scoreExcellent: 'Kiváló',
    scoreGood: 'Jó',
    scoreNeedsImprovement: 'Javításra szorul',
    scoreCritical: 'Kritikus',
    summaryTitle: 'Összefoglaló',
    issuesFound: 'Talált problémák',
    passedChecks: 'Sikeres ellenőrzések',
    viewFullReport: 'Teljes jelentés megtekintése',
    topIssuesTitle: 'Kiemelt problémák',
    upgradeTitle: '🚀 Teljes jelentés feloldása',
    upgradeDescription:
      'Kapjon részletes javítási lépéseket, kódrészleteket és prioritásalapú cselekvési tervet a teljes GDPR megfelelőség eléréséhez.',
    upgradeButton: 'Teljes jelentés beszerzése',
    freeReportNote:
      'Ez az ingyenes összefoglaló jelentése. Frissítsen a teljes elemzéshez végrehajtható ajánlásokkal.',
  },

  paymentConfirmation: {
    subject: 'Fizetés megerősítve - Teljes GDPR jelentés feloldva',
    preheader: 'Fizetése sikeres volt. Férjen hozzá teljes jelentéséhez most.',
    title: '✅ Sikeres fizetés!',
    intro:
      'Köszönjük vásárlását! Teljes GDPR megfelelőségi jelentése most feloldásra került és megtekinthető.',
    orderDetails: 'Rendelés részletei',
    productLabel: 'Termék',
    productName: 'Teljes GDPR megfelelőségi jelentés',
    amountLabel: 'Összeg',
    dateLabel: 'Dátum',
    invoiceNote: 'Nyugtát küldtünk e-mail címére.',
    accessReport: 'Hozzáférés a teljes jelentéshez',
    supportNote:
      'Segítségre van szüksége a jelentés értelmezésében? Csapatunk készséggel áll rendelkezésére.',
  },

  adminNotification: {
    subject: 'Új audit kérelem',
    newRequest: 'Új audit kérelem érkezett',
    details: 'Kérelem részletei',
    marketingOptIn: 'Marketing hozzájárulás',
    yes: 'Igen',
    no: 'Nem',
  },
};
