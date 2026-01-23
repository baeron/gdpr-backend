import { EmailTranslations } from '../types';

export const pt: EmailTranslations = {
  common: {
    greeting: 'Olá',
    thankYou: 'Obrigado por escolher o PolicyTracker!',
    bestRegards: 'Com os melhores cumprimentos',
    team: 'A equipa PolicyTracker',
    questionsContact:
      'Tem perguntas? Responda a este e-mail ou contacte-nos em hello@policytracker.eu',
    automatedMessage:
      'Esta é uma mensagem automática. Por favor, não responda diretamente.',
    viewOnline: 'Ver no navegador',
    unsubscribe: 'Cancelar subscrição',
  },

  auditConfirmation: {
    subject: 'O seu pedido de auditoria RGPD foi recebido',
    preheader:
      'Estamos a analisar o seu website para problemas de conformidade RGPD',
    title: '🎯 O seu pedido de auditoria está confirmado!',
    intro:
      'Obrigado por submeter o seu website para uma auditoria de conformidade RGPD. Levamos a privacidade a sério e estamos aqui para ajudar.',
    websiteLabel: 'Website',
    auditIdLabel: 'ID da auditoria',
    whatHappensNext: 'O que acontece a seguir?',
    step1:
      '🔍 A nossa IA analisa o seu website em mais de 50 pontos de verificação',
    step2:
      '📊 Analisamos cookies, rastreadores, banners de consentimento e políticas de privacidade',
    step3: '📧 Receberá o seu relatório detalhado de conformidade por e-mail',
    estimatedTime: 'Tempo estimado: 5-15 minutos',
    tipTitle: '💡 Dica Pro',
    tipContent:
      'Enquanto espera, reveja a sua política de privacidade atual. Está atualizada? Explica claramente como recolhe e utiliza dados pessoais?',
  },

  auditResults: {
    subject: 'O seu relatório de auditoria RGPD está pronto',
    preheader:
      'A pontuação de conformidade do seu website e recomendações estão prontos',
    title: '📊 O seu relatório de conformidade RGPD',
    intro:
      'Boas notícias! A auditoria do seu website está completa. Aqui está um resumo do seu estado de conformidade RGPD.',
    scoreLabel: 'Pontuação de conformidade',
    scoreExcellent: 'Excelente',
    scoreGood: 'Bom',
    scoreNeedsImprovement: 'Precisa de melhorias',
    scoreCritical: 'Crítico',
    summaryTitle: 'Resumo',
    issuesFound: 'Problemas encontrados',
    passedChecks: 'Verificações aprovadas',
    viewFullReport: 'Ver relatório completo',
    topIssuesTitle: 'Problemas prioritários',
    upgradeTitle: '🚀 Desbloqueie o seu relatório completo',
    upgradeDescription:
      'Obtenha passos detalhados de correção, trechos de código e um plano de ação priorizado para alcançar a conformidade total com o RGPD.',
    upgradeButton: 'Obter relatório completo',
    freeReportNote:
      'Este é o seu relatório resumido gratuito. Faça upgrade para aceder à análise completa com recomendações acionáveis.',
  },

  paymentConfirmation: {
    subject: 'Pagamento confirmado - Relatório RGPD completo desbloqueado',
    preheader:
      'O seu pagamento foi bem-sucedido. Aceda ao seu relatório completo agora.',
    title: '✅ Pagamento bem-sucedido!',
    intro:
      'Obrigado pela sua compra! O seu relatório completo de conformidade RGPD está agora desbloqueado e pronto para visualização.',
    orderDetails: 'Detalhes do pedido',
    productLabel: 'Produto',
    productName: 'Relatório completo de conformidade RGPD',
    amountLabel: 'Valor',
    dateLabel: 'Data',
    invoiceNote: 'Um recibo foi enviado para o seu endereço de e-mail.',
    accessReport: 'Aceder ao seu relatório completo',
    supportNote:
      'Precisa de ajuda para entender o seu relatório? A nossa equipa está aqui para ajudar.',
  },

  adminNotification: {
    subject: 'Novo pedido de auditoria',
    newRequest: 'Novo pedido de auditoria recebido',
    details: 'Detalhes do pedido',
    marketingOptIn: 'Opt-in de marketing',
    yes: 'Sim',
    no: 'Não',
  },
};
