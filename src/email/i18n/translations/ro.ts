import { EmailTranslations } from '../types';

export const ro: EmailTranslations = {
  common: {
    greeting: 'Bună ziua',
    thankYou: 'Vă mulțumim că ați ales PolicyTracker!',
    bestRegards: 'Cu stimă',
    team: 'Echipa PolicyTracker',
    questionsContact:
      'Aveți întrebări? Răspundeți la acest e-mail sau contactați-ne la hello@policytracker.eu',
    automatedMessage:
      'Acesta este un mesaj automat. Vă rugăm să nu răspundeți direct.',
    viewOnline: 'Vizualizați în browser',
    unsubscribe: 'Dezabonare',
  },

  auditConfirmation: {
    subject: 'Cererea dvs. de audit GDPR a fost primită',
    preheader: 'Scanăm site-ul dvs. pentru probleme de conformitate GDPR',
    title: '🎯 Cererea dvs. de audit este confirmată!',
    intro:
      'Vă mulțumim că ați trimis site-ul dvs. pentru un audit de conformitate GDPR. Luăm confidențialitatea în serios și suntem aici să vă ajutăm.',
    websiteLabel: 'Site web',
    auditIdLabel: 'ID audit',
    whatHappensNext: 'Ce urmează?',
    step1:
      '🔍 AI-ul nostru scanează site-ul dvs. pe peste 50 de puncte de verificare',
    step2:
      '📊 Analizăm cookie-uri, trackere, bannere de consimțământ și politici de confidențialitate',
    step3: '📧 Veți primi raportul detaliat de conformitate prin e-mail',
    estimatedTime: 'Timp estimat: 5-15 minute',
    tipTitle: '💡 Sfat Pro',
    tipContent:
      'În timp ce așteptați, verificați politica dvs. actuală de confidențialitate. Este actualizată? Explică clar cum colectați și utilizați datele personale?',
  },

  auditResults: {
    subject: 'Raportul dvs. de audit GDPR este gata',
    preheader: 'Scorul de conformitate al site-ului și recomandările sunt gata',
    title: '📊 Raportul dvs. de conformitate GDPR',
    intro:
      'Vești bune! Auditul site-ului dvs. este complet. Iată un rezumat al stării dvs. de conformitate GDPR.',
    scoreLabel: 'Scor de conformitate',
    scoreExcellent: 'Excelent',
    scoreGood: 'Bun',
    scoreNeedsImprovement: 'Necesită îmbunătățiri',
    scoreCritical: 'Critic',
    summaryTitle: 'Rezumat',
    issuesFound: 'Probleme găsite',
    passedChecks: 'Verificări trecute',
    viewFullReport: 'Vizualizați raportul complet',
    topIssuesTitle: 'Probleme prioritare',
    upgradeTitle: '🚀 Deblocați raportul complet',
    upgradeDescription:
      'Obțineți pași detaliați de remediere, fragmente de cod și un plan de acțiune prioritizat pentru a deveni pe deplin conform cu GDPR.',
    upgradeButton: 'Obțineți raportul complet',
    freeReportNote:
      'Acesta este raportul dvs. rezumat gratuit. Faceți upgrade pentru a accesa analiza completă cu recomandări acționabile.',
  },

  paymentConfirmation: {
    subject: 'Plată confirmată - Raport GDPR complet deblocat',
    preheader:
      'Plata dvs. a fost efectuată cu succes. Accesați raportul complet acum.',
    title: '✅ Plată reușită!',
    intro:
      'Vă mulțumim pentru achiziție! Raportul dvs. complet de conformitate GDPR este acum deblocat și gata de vizualizare.',
    orderDetails: 'Detalii comandă',
    productLabel: 'Produs',
    productName: 'Raport complet de conformitate GDPR',
    amountLabel: 'Sumă',
    dateLabel: 'Data',
    invoiceNote: 'O chitanță a fost trimisă la adresa dvs. de e-mail.',
    accessReport: 'Accesați raportul complet',
    supportNote:
      'Aveți nevoie de ajutor pentru a înțelege raportul? Echipa noastră este aici să vă asiste.',
  },

  adminNotification: {
    subject: 'Nouă cerere de audit',
    newRequest: 'Nouă cerere de audit primită',
    details: 'Detalii cerere',
    marketingOptIn: 'Consimțământ marketing',
    yes: 'Da',
    no: 'Nu',
  },
};
