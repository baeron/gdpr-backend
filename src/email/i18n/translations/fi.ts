import { EmailTranslations } from '../types';

export const fi: EmailTranslations = {
  common: {
    greeting: 'Hei',
    thankYou: 'Kiitos, että valitsit PolicyTrackerin!',
    bestRegards: 'Ystävällisin terveisin',
    team: 'PolicyTracker-tiimi',
    questionsContact:
      'Onko kysyttävää? Vastaa tähän sähköpostiin tai ota yhteyttä osoitteessa hello@policytracker.eu',
    automatedMessage: 'Tämä on automaattinen viesti. Älä vastaa suoraan.',
    viewOnline: 'Näytä selaimessa',
    unsubscribe: 'Peruuta tilaus',
  },

  auditConfirmation: {
    subject: 'GDPR-tarkastuspyyntösi on vastaanotettu',
    preheader:
      'Skannaamme verkkosivustoasi GDPR-yhteensopivuusongelmien varalta',
    title: '🎯 Tarkastuspyyntösi on vahvistettu!',
    intro:
      'Kiitos verkkosivustosi lähettämisestä GDPR-yhteensopivuustarkastukseen. Otamme yksityisyyden vakavasti ja olemme täällä auttamassa.',
    websiteLabel: 'Verkkosivusto',
    auditIdLabel: 'Tarkastustunnus',
    whatHappensNext: 'Mitä seuraavaksi?',
    step1:
      '🔍 Tekoälymme skannaa verkkosivustosi yli 50 yhteensopivuustarkistuspisteessä',
    step2:
      '📊 Analysoimme evästeet, seurantaohjelmat, suostumusbannerit ja tietosuojakäytännöt',
    step3: '📧 Saat yksityiskohtaisen yhteensopivuusraportin sähköpostilla',
    estimatedTime: 'Arvioitu aika: 5-15 minuuttia',
    tipTitle: '💡 Vinkki',
    tipContent:
      'Odottaessasi tarkista nykyinen tietosuojakäytäntösi. Onko se ajan tasalla? Selittääkö se selkeästi, miten keräät ja käytät henkilötietoja?',
  },

  auditResults: {
    subject: 'GDPR-tarkastusraporttisi on valmis',
    preheader:
      'Verkkosivustosi yhteensopivuuspisteet ja suositukset ovat valmiita',
    title: '📊 GDPR-yhteensopivuusraporttisi',
    intro:
      'Hyviä uutisia! Verkkosivustosi tarkastus on valmis. Tässä yhteenveto GDPR-yhteensopivuustilastasi.',
    scoreLabel: 'Yhteensopivuuspisteet',
    scoreExcellent: 'Erinomainen',
    scoreGood: 'Hyvä',
    scoreNeedsImprovement: 'Parantamisen varaa',
    scoreCritical: 'Kriittinen',
    summaryTitle: 'Yhteenveto',
    issuesFound: 'Löydetyt ongelmat',
    passedChecks: 'Läpäistyt tarkistukset',
    viewFullReport: 'Näytä koko raportti',
    topIssuesTitle: 'Ensisijaiset ongelmat',
    upgradeTitle: '🚀 Avaa täysi raporttisi',
    upgradeDescription:
      'Saat yksityiskohtaiset korjausvaiheet, koodinpätkät ja priorisoidun toimintasuunnitelman täyden GDPR-yhteensopivuuden saavuttamiseksi.',
    upgradeButton: 'Hanki täysi raportti',
    freeReportNote:
      'Tämä on ilmainen yhteenvetoraporttisi. Päivitä saadaksesi täyden analyysin toimivine suosituksineen.',
  },

  paymentConfirmation: {
    subject: 'Maksu vahvistettu - Täysi GDPR-raportti avattu',
    preheader: 'Maksusi onnistui. Pääset nyt täyteen raporttiisi.',
    title: '✅ Maksu onnistui!',
    intro:
      'Kiitos ostoksestasi! Täysi GDPR-yhteensopivuusraporttisi on nyt avattu ja valmis katseltavaksi.',
    orderDetails: 'Tilauksen tiedot',
    productLabel: 'Tuote',
    productName: 'Täysi GDPR-yhteensopivuusraportti',
    amountLabel: 'Summa',
    dateLabel: 'Päivämäärä',
    invoiceNote: 'Kuitti on lähetetty sähköpostiosoitteeseesi.',
    accessReport: 'Pääsy täyteen raporttiisi',
    supportNote:
      'Tarvitsetko apua raporttisi ymmärtämisessä? Tiimimme on täällä auttamassa.',
  },

  adminNotification: {
    subject: 'Uusi tarkastuspyyntö',
    newRequest: 'Uusi tarkastuspyyntö vastaanotettu',
    details: 'Pyynnön tiedot',
    marketingOptIn: 'Markkinointisuostumus',
    yes: 'Kyllä',
    no: 'Ei',
  },
};
