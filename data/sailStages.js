// Minimal sail stages dataset used by story-mode (static, data-only)
// Each stage's `waves` is an array of enemy ID arrays. When a wave has
// more than 3 enemies the follow-up enemies are represented as subsequent
// inner arrays so callers can advance to the next wave after the first
// three enemies are defeated. Rewards are first-time only.
module.exports = [
  {
    id: 'fusha_village',
    name: 'Fushia Village',
    stages: [
      { stage: 1, waves: [[120]] },
      { stage: 2, waves: [[27]] },
      { stage: 3, waves: [[28]] }
    ],
    rewards: { firstTime: { gems: 2, bounty: 1000000 } }
  },
  {
    id: 'alvidas_hideout',
    name: "Alvida's Hideout",
    stages: [
      { stage: 1, waves: [[136]] },
      { stage: 2, waves: [[141,122,123]] },
      { stage: 3, waves: [[137,138,29]] }
    ],
    rewards: { firstTime: { gems: 5, id_card: '0031', bounty: 1000000 } }
  },
  {
    id: 'shells_town',
    name: "Shell's Town",
    stages: [
      { stage: 1, waves: [[179,180,182]] },
      { stage: 2, waves: [[183,179,180]] },
      { stage: 3, waves: [[33,179,180],[181]] },
      { stage: 4, waves: [[179,180,181,182]] },
      { stage: 5, waves: [[187,182]] },
      { stage: 6, waves: [[188]] },
      { stage: 7, waves: [[184,185,186,187]] },
      { stage: 8, waves: [[33,184,185,186,187]] },
      { stage: 9, waves: [[35]] }
    ],
    rewards: { firstTime: { gems: 5, id_card: '0005', bounty: 2500000 } }
  },
  {
    id: 'orange_town',
    name: 'Orange Town',
    stages: [
      { stage: 1, waves: [[174]] },
      { stage: 2, waves: [[170,136]] },
      { stage: 3, waves: [[178,128,133]] },
      { stage: 4, waves: [[172,132]] },
      { stage: 5, waves: [[38,136,137,138]] },
      { stage: 6, waves: [[173]] },
      { stage: 7, waves: [[170,142]] },
      { stage: 8, waves: [[36,134,135]] },
      { stage: 9, waves: [[174,162,141]] },
      { stage: 10, waves: [[121,176,126]] },
      { stage: 11, waves: [[37]] },
      { stage: 12, waves: [[171,149,154]] },
      { stage: 13, waves: [[39,142,153,154]] }
    ],
    rewards: { firstTime: { gems: 5, id_card: '0040', bounty: 1000000 } }
  },
  {
    id: 'syrup_village',
    name: 'Syrup Village',
    stages: [
      { stage: 1, waves: [[13]] },
      { stage: 2, waves: [[163]] },
      { stage: 3, waves: [[174]] },
      { stage: 4, waves: [[43]] },
      { stage: 5, waves: [[45]] },
      { stage: 6, waves: [[164]] },
      { stage: 7, waves: [[165,156,167]] },
      { stage: 8, waves: [[173]] },
      { stage: 9, waves: [[41]] },
      { stage: 10, waves: [[42]] },
      { stage: 11, waves: [[41,42]] },
      { stage: 12, waves: [[43]] },
      { stage: 13, waves: [[45]] }
    ],
    rewards: { firstTime: { gems: 5, id_card: '0013', ship_card: 'Going Merry', bounty: 1000000 } }
  },
  {
    id: 'baratie',
    name: 'Baratie',
    stages: [
      { stage: 1, waves: [[136,137,138,140,48]] },
      { stage: 2, waves: [[49]] },
      { stage: 3, waves: [[52]] },
      { stage: 4, waves: [[53]] },
      { stage: 5, waves: [[57]] },
      { stage: 6, waves: [[170,171]] },
      { stage: 7, waves: [[173,172]] },
      { stage: 8, waves: [[55]] },
      { stage: 9, waves: [[56]] },
      { stage: 10, waves: [[173,174]] },
      { stage: 11, waves: [[56,144,149,159]] },
      { stage: 12, waves: [[54]] },
      { stage: 13, waves: [[170,173,145,150]] },
      { stage: 14, waves: [[171,172,174]] },
      { stage: 15, waves: [[58]] }
    ],
    rewards: { firstTime: { gems: 5, ship_card: 'Baratie', id_card_1: '0050', id_card_2: '0051', bounty: 1000000 } }
  },
  {
    id: 'arlong_park',
    name: 'Arlong Park',
    stages: [
      { stage: 1, waves: [[178,173]] },
      { stage: 2, waves: [[174,177,153]] },
      { stage: 3, waves: [[175,176,177,173]] },
      { stage: 4, waves: [[59,184,185,186,187,188]] },
      { stage: 5, waves: [[173,174]] },
      { stage: 6, waves: [[170,171,172]] },
      { stage: 7, waves: [[60]] },
      { stage: 8, waves: [[62,142,143,144,145,146]] },
      { stage: 9, waves: [[174,178]] },
      { stage: 10, waves: [[63]] },
      { stage: 11, waves: [[64]] },
      { stage: 12, waves: [[175,176,177]] },
      { stage: 13, waves: [[65]] },
      { stage: 14, waves: [[66,62,64]] }
    ],
    rewards: { firstTime: { gems: 5, id_card: '0005', ship_card: 'Navy Ship' } }
  },
  {
    id: 'loguetown',
    name: 'Loguetown',
    stages: [
      { stage: 1, waves: [[174,170,171,172]] },
      { stage: 2, waves: [[30]] },
      { stage: 3, waves: [[174,173]] },
      { stage: 4, waves: [[36]] },
      { stage: 5, waves: [[174,162]] },
      { stage: 6, waves: [[30,36]] },
      { stage: 7, waves: [[37,39]] },
      { stage: 8, waves: [[194,179,184]] },
      { stage: 9, waves: [[195,180,185]] },
      { stage: 10, waves: [[67,179,180,181,182,183]] },
      { stage: 11, waves: [[198,184,185,186]] },
      { stage: 12, waves: [[69]] }
    ],
    rewards: { firstTime: { gems: 5, bounty: 3000000 } }
  }
];
