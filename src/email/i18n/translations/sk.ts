import { EmailTranslations } from '../types';

export const sk: EmailTranslations = {
  common: {
    greeting: 'Dobrý deň',
    thankYou: 'Ďakujeme, že ste si vybrali PolicyTracker!',
    bestRegards: 'S pozdravom',
    team: 'Tím PolicyTracker',
    questionsContact:
      'Máte otázky? Odpovedzte na tento e-mail alebo nás kontaktujte na hello@policytracker.eu',
    automatedMessage:
      'Toto je automatická správa. Prosím neodpovedajte priamo.',
    viewOnline: 'Zobraziť v prehliadači',
    unsubscribe: 'Odhlásiť odber',
  },

  auditConfirmation: {
    subject: 'Vaša žiadosť o audit GDPR bola prijatá',
    preheader: 'Skenujeme váš web na problémy s dodržiavaním GDPR',
    title: '🎯 Vaša žiadosť o audit je potvrdená!',
    intro:
      'Ďakujeme za odoslanie vášho webu na audit súladu s GDPR. Súkromie berieme vážne a sme tu, aby sme vám pomohli.',
    websiteLabel: 'Webová stránka',
    auditIdLabel: 'ID auditu',
    whatHappensNext: 'Čo bude ďalej?',
    step1: '🔍 Naša AI skenuje váš web na viac ako 50 kontrolných bodov',
    step2:
      '📊 Analyzujeme cookies, sledovače, bannery súhlasu a zásady ochrany osobných údajov',
    step3: '📧 Dostanete podrobnú správu o súlade e-mailom',
    estimatedTime: 'Odhadovaný čas: 5-15 minút',
    tipTitle: '💡 Tip',
    tipContent:
      'Kým čakáte, skontrolujte svoje aktuálne zásady ochrany osobných údajov. Sú aktuálne? Jasne vysvetľujú, ako zhromažďujete a používate osobné údaje?',
  },

  auditResults: {
    subject: 'Vaša správa o audite GDPR je pripravená',
    preheader: 'Skóre súladu vášho webu a odporúčania sú pripravené',
    title: '📊 Vaša správa o súlade s GDPR',
    intro:
      'Skvelé správy! Audit vášho webu je dokončený. Tu je zhrnutie vášho stavu súladu s GDPR.',
    scoreLabel: 'Skóre súladu',
    scoreExcellent: 'Vynikajúce',
    scoreGood: 'Dobré',
    scoreNeedsImprovement: 'Vyžaduje zlepšenie',
    scoreCritical: 'Kritické',
    summaryTitle: 'Zhrnutie',
    issuesFound: 'Nájdené problémy',
    passedChecks: 'Úspešné kontroly',
    viewFullReport: 'Zobraziť úplnú správu',
    topIssuesTitle: 'Prioritné problémy',
    upgradeTitle: '🚀 Odomknite úplnú správu',
    upgradeDescription:
      'Získajte podrobné kroky k náprave, úryvky kódu a prioritizovaný akčný plán na dosiahnutie plného súladu s GDPR.',
    upgradeButton: 'Získať úplnú správu',
    freeReportNote:
      'Toto je vaša bezplatná súhrnná správa. Aktualizujte pre prístup k úplnej analýze s praktickými odporúčaniami.',
  },

  paymentConfirmation: {
    subject: 'Platba potvrdená - Úplná správa GDPR odomknutá',
    preheader: 'Vaša platba bola úspešná. Získajte prístup k úplnej správe.',
    title: '✅ Platba úspešná!',
    intro:
      'Ďakujeme za váš nákup! Vaša úplná správa o súlade s GDPR je teraz odomknutá a pripravená na zobrazenie.',
    orderDetails: 'Detaily objednávky',
    productLabel: 'Produkt',
    productName: 'Úplná správa o súlade s GDPR',
    amountLabel: 'Suma',
    dateLabel: 'Dátum',
    invoiceNote: 'Potvrdenie bolo zaslané na vašu e-mailovú adresu.',
    accessReport: 'Prístup k úplnej správe',
    supportNote:
      'Potrebujete pomoc s pochopením správy? Náš tím je tu pre vás.',
  },

  adminNotification: {
    subject: 'Nová žiadosť o audit',
    newRequest: 'Prijatá nová žiadosť o audit',
    details: 'Detaily žiadosti',
    marketingOptIn: 'Marketingový súhlas',
    yes: 'Áno',
    no: 'Nie',
  },
};
