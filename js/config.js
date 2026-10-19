export const PLACARD_REFERENCE = {
  period: '2026-08',
  label: 'Placard FRPB57 · août 2026',
  note: 'Marge rayon après frais service utilisée comme cible de pilotage. La marge brute placard est conservée comme référence.',
  departments: {
    FL: {name:'Fruits & Légumes', gross:0.3485, net:0.2870, cumulativeGross:0.3471, cumulativeNet:0.2860},
    POISSON: {name:'Poisson', gross:0.3336, net:0.2850, cumulativeGross:0.3223, cumulativeNet:0.2728},
    CHARCUT: {name:'Charcuterie', gross:0.4488, net:0.4138, cumulativeGross:0.4436, cumulativeNet:0.4086},
    FROMAGE: {name:'Fromage', gross:0.3438, net:0.3028, cumulativeGross:0.3406, cumulativeNet:0.2993},
    BOUCHERIE: {name:'Boucherie', gross:0.3923, net:0.3560, cumulativeGross:0.3971, cumulativeNet:0.3611},
    VOLAILLE: {name:'Volaille', gross:0.3694, net:0.3499, cumulativeGross:0.3633, cumulativeNet:0.3415},
    PVP: {name:'PVP', gross:0.6016, net:0.5651, cumulativeGross:0.5914, cumulativeNet:0.5540}
  }
};

// Bilan de Santé Client 2025 - heatmap CA magasin, tous clients, hors carburant.
// Le document définit : surpondération si indice > 115, sous-pondération si indice < 85.
// Les poids ci-dessous sont une traduction de pilotage (pas les indices Carrefour exacts) :
// ils reproduisent la forme visible du heatmap et sont ensuite normalisés à 100 % du budget du mois.
export const STORE_SEASONALITY_REFERENCE = {
  label: 'BDS Client 2025 · répartition annuelle du CA',
  sourcePeriod: 'cumul octobre 2023 à fin septembre 2025',
  overIndex: 115,
  underIndex: 85,
  weekdayWeights: [0.65,0.92,0.97,1.00,1.02,1.15,1.22], // Dim -> Sam
  note: 'Profil initial issu de la lecture du code couleur : vendredi/samedi plus forts, dimanche nettement plus faible. Ces poids sont recalibrables avec les données quotidiennes réelles.'
};



// Règles d'ouverture communiquées par la Direction pour les jours fériés.
// Les coefficients de report sont des réglages de départ : ils seront recalibrables
// à partir des CA quotidiens réellement enregistrés.
export const STORE_HOLIDAY_RULES = {
  label: 'Règles jours fériés · Isigny-sur-Mer',
  closedHolidayKeys: ['new-year','labour-day','christmas'],
  mondayToThursdayMode: 'sunday-like',
  fridaySaturdayClosingFactor: 0.90,
  preHolidayFactor: 1.10,
  postHolidayFactor: 1.10,
  note: 'Lundi à jeudi férié : activité traitée comme un dimanche. Vendredi/samedi férié : fermeture à 18 h, poids réduit de 10 %. 1er mai, Noël et Jour de l’An : fermé. Quand un férié tombe du lundi au jeudi, le jour précédent et le jour suivant reçoivent provisoirement +10 % de poids.'
};

export const FL_SALES_REFERENCE = {
  label: 'Fruits & Légumes · historique CA TTC',
  actual2025: {
    1:24274.91,2:25384.90,3:27701.43,4:31747.72,5:32568.98,6:34574.55,
    7:41410.66,8:40026.77,9:25929.03,10:24608.85,11:18479.42,12:25399.85
  },
  annual2025: 352107.07,
  actual2026: {
    1:23857.15,2:24538.65,3:26315.68,4:33456.12,5:35642.86,6:37155.77,
    7:46764.15,8:41903.00,9:28716.10
  },
  // Projection Q4 : 60 % de la tendance Jan-Sept (+5,19 %) + 40 % de la tendance Avr-Sept (+8,43 %)
  // soit +6,49 %, arrondi à +6,5 % appliqué aux mois comparables 2025.
  forecastGrowthQ4: 0.065,
  forecast2026: {10:26208.43,11:19680.58,12:27050.84},
  projectedAnnual2026: 371289.33,
  method: 'Q4 2026 = CA du même mois 2025 × 1,065. Le budget journalier est ensuite réparti avec le profil de saisonnalité BDS et se recalibre avec les données réelles.',
  status2026: {1:'actual',2:'actual',3:'actual',4:'actual',5:'actual',6:'actual',7:'actual',8:'actual',9:'actual',10:'forecast',11:'forecast',12:'forecast'}
};

export const APP_CONFIG = {
  storeName: 'Carrefour Market Isigny-sur-Mer',
  storeCode: 'ISIGNY',
  supabaseUrl: window.APP_SUPABASE_URL || '',
  supabasePublishableKey: window.APP_SUPABASE_PUBLISHABLE_KEY || '',
  defaultDepartments: [
    {code:'FL',name:'Fruits & Légumes'},
    {code:'POISSON',name:'Poisson'},
    {code:'CHARCUT',name:'Charcuterie'},
    {code:'FROMAGE',name:'Fromage'},
    {code:'BOUCHERIE',name:'Boucherie'},
    {code:'VOLAILLE',name:'Volaille'},
    {code:'PVP',name:'PVP'}
  ],
  locale: 'fr-FR',
  currency: 'EUR'
};
