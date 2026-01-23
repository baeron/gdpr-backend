import { EmailTranslations } from '../types';

export const de: EmailTranslations = {
  common: {
    greeting: 'Hallo',
    thankYou: 'Vielen Dank, dass Sie sich für PolicyTracker entschieden haben!',
    bestRegards: 'Mit freundlichen Grüßen',
    team: 'Das PolicyTracker-Team',
    questionsContact:
      'Haben Sie Fragen? Antworten Sie auf diese E-Mail oder kontaktieren Sie uns unter hello@policytracker.eu',
    automatedMessage:
      'Dies ist eine automatisch generierte Nachricht. Bitte antworten Sie nicht direkt.',
    viewOnline: 'Im Browser ansehen',
    unsubscribe: 'Abmelden',
  },

  auditConfirmation: {
    subject: 'Ihre DSGVO-Audit-Anfrage wurde empfangen',
    preheader: 'Wir scannen Ihre Website auf DSGVO-Konformitätsprobleme',
    title: '🎯 Ihre Audit-Anfrage ist bestätigt!',
    intro:
      'Vielen Dank für die Einreichung Ihrer Website zur DSGVO-Konformitätsprüfung. Datenschutz ist uns wichtig, und wir helfen Ihnen gerne dabei.',
    websiteLabel: 'Website',
    auditIdLabel: 'Audit-ID',
    whatHappensNext: 'Was passiert als nächstes?',
    step1:
      '🔍 Unsere KI scannt Ihre Website auf über 50 Compliance-Checkpunkte',
    step2:
      '📊 Wir analysieren Cookies, Tracker, Einwilligungsbanner und Datenschutzrichtlinien',
    step3: '📧 Sie erhalten Ihren detaillierten Compliance-Bericht per E-Mail',
    estimatedTime: 'Geschätzte Zeit: 5-15 Minuten',
    tipTitle: '💡 Profi-Tipp',
    tipContent:
      'Überprüfen Sie während der Wartezeit Ihre aktuelle Datenschutzrichtlinie. Ist sie aktuell? Erklärt sie klar, wie Sie personenbezogene Daten erheben und verwenden?',
  },

  auditResults: {
    subject: 'Ihr DSGVO-Audit-Bericht ist fertig',
    preheader: 'Ihr Website-Compliance-Score und Empfehlungen sind bereit',
    title: '📊 Ihr DSGVO-Konformitätsbericht',
    intro:
      'Gute Nachrichten! Ihr Website-Audit ist abgeschlossen. Hier ist eine Zusammenfassung Ihres DSGVO-Konformitätsstatus.',
    scoreLabel: 'Compliance-Score',
    scoreExcellent: 'Ausgezeichnet',
    scoreGood: 'Gut',
    scoreNeedsImprovement: 'Verbesserungsbedarf',
    scoreCritical: 'Kritisch',
    summaryTitle: 'Zusammenfassung',
    issuesFound: 'Gefundene Probleme',
    passedChecks: 'Bestandene Prüfungen',
    viewFullReport: 'Vollständigen Bericht ansehen',
    topIssuesTitle: 'Prioritäre Probleme',
    upgradeTitle: '🚀 Vollständigen Bericht freischalten',
    upgradeDescription:
      'Erhalten Sie detaillierte Behebungsschritte, Code-Snippets und einen priorisierten Aktionsplan für vollständige DSGVO-Konformität.',
    upgradeButton: 'Vollständigen Bericht erhalten',
    freeReportNote:
      'Dies ist Ihr kostenloser Zusammenfassungsbericht. Upgraden Sie, um die vollständige Analyse mit umsetzbaren Empfehlungen zu erhalten.',
  },

  paymentConfirmation: {
    subject: 'Zahlung bestätigt - Vollständiger DSGVO-Bericht freigeschaltet',
    preheader:
      'Ihre Zahlung war erfolgreich. Greifen Sie jetzt auf Ihren vollständigen Bericht zu.',
    title: '✅ Zahlung erfolgreich!',
    intro:
      'Vielen Dank für Ihren Kauf! Ihr vollständiger DSGVO-Konformitätsbericht ist jetzt freigeschaltet und bereit zur Ansicht.',
    orderDetails: 'Bestelldetails',
    productLabel: 'Produkt',
    productName: 'Vollständiger DSGVO-Konformitätsbericht',
    amountLabel: 'Betrag',
    dateLabel: 'Datum',
    invoiceNote: 'Eine Quittung wurde an Ihre E-Mail-Adresse gesendet.',
    accessReport: 'Auf Ihren vollständigen Bericht zugreifen',
    supportNote:
      'Brauchen Sie Hilfe beim Verstehen Ihres Berichts? Unser Team steht Ihnen zur Verfügung.',
  },

  adminNotification: {
    subject: 'Neue Audit-Anfrage',
    newRequest: 'Neue Audit-Anfrage eingegangen',
    details: 'Anfragedetails',
    marketingOptIn: 'Marketing-Einwilligung',
    yes: 'Ja',
    no: 'Nein',
  },
};
