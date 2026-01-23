import { EmailTranslations } from '../types';

export const fr: EmailTranslations = {
  common: {
    greeting: 'Bonjour',
    thankYou: "Merci d'avoir choisi PolicyTracker !",
    bestRegards: 'Cordialement',
    team: "L'équipe PolicyTracker",
    questionsContact:
      'Des questions ? Répondez à cet e-mail ou contactez-nous à hello@policytracker.eu',
    automatedMessage:
      'Ceci est un message automatique. Veuillez ne pas répondre directement.',
    viewOnline: 'Voir dans le navigateur',
    unsubscribe: 'Se désabonner',
  },

  auditConfirmation: {
    subject: "Votre demande d'audit RGPD a été reçue",
    preheader:
      'Nous analysons votre site web pour les problèmes de conformité RGPD',
    title: "🎯 Votre demande d'audit est confirmée !",
    intro:
      "Merci d'avoir soumis votre site web pour un audit de conformité RGPD. Nous prenons la confidentialité au sérieux et nous sommes là pour vous aider.",
    websiteLabel: 'Site web',
    auditIdLabel: "ID de l'audit",
    whatHappensNext: 'Quelle est la suite ?',
    step1: '🔍 Notre IA analyse votre site sur plus de 50 points de conformité',
    step2:
      '📊 Nous analysons les cookies, les trackers, les bannières de consentement et les politiques de confidentialité',
    step3: '📧 Vous recevez votre rapport de conformité détaillé par e-mail',
    estimatedTime: 'Temps estimé : 5-15 minutes',
    tipTitle: '💡 Conseil Pro',
    tipContent:
      'En attendant, examinez votre politique de confidentialité actuelle. Est-elle à jour ? Explique-t-elle clairement comment vous collectez et utilisez les données personnelles ?',
  },

  auditResults: {
    subject: "Votre rapport d'audit RGPD est prêt",
    preheader:
      'Le score de conformité de votre site et les recommandations sont prêts',
    title: '📊 Votre rapport de conformité RGPD',
    intro:
      "Bonne nouvelle ! L'audit de votre site web est terminé. Voici un résumé de votre statut de conformité RGPD.",
    scoreLabel: 'Score de conformité',
    scoreExcellent: 'Excellent',
    scoreGood: 'Bon',
    scoreNeedsImprovement: 'À améliorer',
    scoreCritical: 'Critique',
    summaryTitle: 'Résumé',
    issuesFound: 'Problèmes trouvés',
    passedChecks: 'Vérifications réussies',
    viewFullReport: 'Voir le rapport complet',
    topIssuesTitle: 'Problèmes prioritaires',
    upgradeTitle: '🚀 Débloquez votre rapport complet',
    upgradeDescription:
      "Obtenez des étapes de correction détaillées, des extraits de code et un plan d'action priorisé pour devenir pleinement conforme au RGPD.",
    upgradeButton: 'Obtenir le rapport complet',
    freeReportNote:
      "Ceci est votre rapport résumé gratuit. Passez à la version supérieure pour accéder à l'analyse complète avec des recommandations exploitables.",
  },

  paymentConfirmation: {
    subject: 'Paiement confirmé - Rapport RGPD complet débloqué',
    preheader:
      'Votre paiement a été effectué. Accédez à votre rapport complet maintenant.',
    title: '✅ Paiement réussi !',
    intro:
      'Merci pour votre achat ! Votre rapport complet de conformité RGPD est maintenant débloqué et prêt à être consulté.',
    orderDetails: 'Détails de la commande',
    productLabel: 'Produit',
    productName: 'Rapport complet de conformité RGPD',
    amountLabel: 'Montant',
    dateLabel: 'Date',
    invoiceNote: 'Un reçu a été envoyé à votre adresse e-mail.',
    accessReport: 'Accéder à votre rapport complet',
    supportNote:
      "Besoin d'aide pour comprendre votre rapport ? Notre équipe est là pour vous aider.",
  },

  adminNotification: {
    subject: "Nouvelle demande d'audit",
    newRequest: "Nouvelle demande d'audit reçue",
    details: 'Détails de la demande',
    marketingOptIn: 'Opt-in marketing',
    yes: 'Oui',
    no: 'Non',
  },
};
