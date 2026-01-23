import { EmailTranslations } from '../types';

export const es: EmailTranslations = {
  common: {
    greeting: 'Hola',
    thankYou: '¡Gracias por elegir PolicyTracker!',
    bestRegards: 'Saludos cordiales',
    team: 'El equipo de PolicyTracker',
    questionsContact:
      '¿Tienes preguntas? Responde a este correo o contáctanos en hello@policytracker.eu',
    automatedMessage:
      'Este es un mensaje automático. Por favor, no respondas directamente.',
    viewOnline: 'Ver en el navegador',
    unsubscribe: 'Darse de baja',
  },

  auditConfirmation: {
    subject: 'Tu solicitud de auditoría RGPD ha sido recibida',
    preheader:
      'Estamos escaneando tu sitio web en busca de problemas de cumplimiento RGPD',
    title: '🎯 ¡Tu solicitud de auditoría está confirmada!',
    intro:
      'Gracias por enviar tu sitio web para una auditoría de cumplimiento RGPD. Nos tomamos la privacidad en serio y estamos aquí para ayudarte.',
    websiteLabel: 'Sitio web',
    auditIdLabel: 'ID de auditoría',
    whatHappensNext: '¿Qué sucede a continuación?',
    step1: '🔍 Nuestra IA escanea tu sitio web en más de 50 puntos de control',
    step2:
      '📊 Analizamos cookies, rastreadores, banners de consentimiento y políticas de privacidad',
    step3:
      '📧 Recibirás tu informe detallado de cumplimiento por correo electrónico',
    estimatedTime: 'Tiempo estimado: 5-15 minutos',
    tipTitle: '💡 Consejo Pro',
    tipContent:
      'Mientras esperas, revisa tu política de privacidad actual. ¿Está actualizada? ¿Explica claramente cómo recopilas y utilizas los datos personales?',
  },

  auditResults: {
    subject: 'Tu informe de auditoría RGPD está listo',
    preheader: 'Tu puntuación de cumplimiento y recomendaciones están listos',
    title: '📊 Tu informe de cumplimiento RGPD',
    intro:
      '¡Buenas noticias! La auditoría de tu sitio web ha finalizado. Aquí tienes un resumen de tu estado de cumplimiento RGPD.',
    scoreLabel: 'Puntuación de cumplimiento',
    scoreExcellent: 'Excelente',
    scoreGood: 'Bueno',
    scoreNeedsImprovement: 'Necesita mejoras',
    scoreCritical: 'Crítico',
    summaryTitle: 'Resumen',
    issuesFound: 'Problemas encontrados',
    passedChecks: 'Verificaciones superadas',
    viewFullReport: 'Ver informe completo',
    topIssuesTitle: 'Problemas prioritarios',
    upgradeTitle: '🚀 Desbloquea tu informe completo',
    upgradeDescription:
      'Obtén pasos detallados de corrección, fragmentos de código y un plan de acción priorizado para lograr el cumplimiento total del RGPD.',
    upgradeButton: 'Obtener informe completo',
    freeReportNote:
      'Este es tu informe resumen gratuito. Actualiza para acceder al análisis completo con recomendaciones prácticas.',
  },

  paymentConfirmation: {
    subject: 'Pago confirmado - Informe RGPD completo desbloqueado',
    preheader: 'Tu pago fue exitoso. Accede a tu informe completo ahora.',
    title: '✅ ¡Pago exitoso!',
    intro:
      '¡Gracias por tu compra! Tu informe completo de cumplimiento RGPD ahora está desbloqueado y listo para ver.',
    orderDetails: 'Detalles del pedido',
    productLabel: 'Producto',
    productName: 'Informe completo de cumplimiento RGPD',
    amountLabel: 'Importe',
    dateLabel: 'Fecha',
    invoiceNote:
      'Se ha enviado un recibo a tu dirección de correo electrónico.',
    accessReport: 'Accede a tu informe completo',
    supportNote:
      '¿Necesitas ayuda para entender tu informe? Nuestro equipo está aquí para ayudarte.',
  },

  adminNotification: {
    subject: 'Nueva solicitud de auditoría',
    newRequest: 'Nueva solicitud de auditoría recibida',
    details: 'Detalles de la solicitud',
    marketingOptIn: 'Opt-in de marketing',
    yes: 'Sí',
    no: 'No',
  },
};
