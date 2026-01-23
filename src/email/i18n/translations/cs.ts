import { EmailTranslations } from '../types';

export const cs: EmailTranslations = {
  common: {
    greeting: 'Dobrý den',
    thankYou: 'Děkujeme, že jste si vybrali PolicyTracker!',
    bestRegards: 'S pozdravem',
    team: 'Tým PolicyTracker',
    questionsContact:
      'Máte dotazy? Odpovězte na tento e-mail nebo nás kontaktujte na hello@policytracker.eu',
    automatedMessage: 'Toto je automatická zpráva. Prosím neodpovídejte přímo.',
    viewOnline: 'Zobrazit v prohlížeči',
    unsubscribe: 'Odhlásit odběr',
  },

  auditConfirmation: {
    subject: 'Váš požadavek na audit GDPR byl přijat',
    preheader: 'Skenujeme váš web na problémy s dodržováním GDPR',
    title: '🎯 Váš požadavek na audit je potvrzen!',
    intro:
      'Děkujeme za odeslání vašeho webu k auditu souladu s GDPR. Soukromí bereme vážně a jsme tu, abychom vám pomohli.',
    websiteLabel: 'Webová stránka',
    auditIdLabel: 'ID auditu',
    whatHappensNext: 'Co bude dál?',
    step1: '🔍 Naše AI skenuje váš web na více než 50 kontrolních bodů',
    step2:
      '📊 Analyzujeme cookies, sledovače, bannery souhlasu a zásady ochrany osobních údajů',
    step3: '📧 Obdržíte podrobnou zprávu o souladu e-mailem',
    estimatedTime: 'Odhadovaný čas: 5-15 minut',
    tipTitle: '💡 Tip',
    tipContent:
      'Zatímco čekáte, zkontrolujte své aktuální zásady ochrany osobních údajů. Jsou aktuální? Jasně vysvětlují, jak shromažďujete a používáte osobní údaje?',
  },

  auditResults: {
    subject: 'Vaše zpráva o auditu GDPR je připravena',
    preheader: 'Skóre souladu vašeho webu a doporučení jsou připraveny',
    title: '📊 Vaše zpráva o souladu s GDPR',
    intro:
      'Skvělé zprávy! Audit vašeho webu je dokončen. Zde je shrnutí vašeho stavu souladu s GDPR.',
    scoreLabel: 'Skóre souladu',
    scoreExcellent: 'Vynikající',
    scoreGood: 'Dobré',
    scoreNeedsImprovement: 'Vyžaduje zlepšení',
    scoreCritical: 'Kritické',
    summaryTitle: 'Shrnutí',
    issuesFound: 'Nalezené problémy',
    passedChecks: 'Úspěšné kontroly',
    viewFullReport: 'Zobrazit úplnou zprávu',
    topIssuesTitle: 'Prioritní problémy',
    upgradeTitle: '🚀 Odemkněte úplnou zprávu',
    upgradeDescription:
      'Získejte podrobné kroky k nápravě, úryvky kódu a prioritizovaný akční plán pro dosažení plného souladu s GDPR.',
    upgradeButton: 'Získat úplnou zprávu',
    freeReportNote:
      'Toto je vaše bezplatná souhrnná zpráva. Upgradujte pro přístup k úplné analýze s praktickými doporučeními.',
  },

  paymentConfirmation: {
    subject: 'Platba potvrzena - Úplná zpráva GDPR odemčena',
    preheader: 'Vaše platba byla úspěšná. Získejte přístup k úplné zprávě.',
    title: '✅ Platba úspěšná!',
    intro:
      'Děkujeme za váš nákup! Vaše úplná zpráva o souladu s GDPR je nyní odemčena a připravena k zobrazení.',
    orderDetails: 'Detaily objednávky',
    productLabel: 'Produkt',
    productName: 'Úplná zpráva o souladu s GDPR',
    amountLabel: 'Částka',
    dateLabel: 'Datum',
    invoiceNote: 'Potvrzení bylo zasláno na vaši e-mailovou adresu.',
    accessReport: 'Přístup k úplné zprávě',
    supportNote:
      'Potřebujete pomoc s pochopením zprávy? Náš tým je tu pro vás.',
  },

  adminNotification: {
    subject: 'Nový požadavek na audit',
    newRequest: 'Přijat nový požadavek na audit',
    details: 'Detaily požadavku',
    marketingOptIn: 'Marketingový souhlas',
    yes: 'Ano',
    no: 'Ne',
  },
};
