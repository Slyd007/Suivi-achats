export const resolveTargetMarginRate = (budget, department) => budget?.target_margin_rate ?? department?.target_margin_rate ?? null;
export const round2 = n => Math.round((Number(n || 0)+Number.EPSILON)*100)/100;
export const toHT = (ttc, vatRate) => round2(Number(ttc || 0)/(1+Number(vatRate || 0)));
export const purchaseBudgetMax = (budgetCaTtc, vatRate, targetMarginRate) => {
  if (budgetCaTtc == null || targetMarginRate == null) return null;
  return round2(toHT(budgetCaTtc, vatRate)*(1-Number(targetMarginRate)));
};
export const purchaseTotal = entry => round2(Number(entry?.purchase_ht_ex_promo||0)+Number(entry?.promo_purchase_ht||0));
export const budgetGap = (budgetMax, purchases) => budgetMax == null ? null : round2(Number(budgetMax)-Number(purchases||0));
export const usageRate = (budgetMax, purchases) => !budgetMax ? null : Number(purchases||0)/Number(budgetMax);
export const theoreticalMarginRateOnBudget = (budgetCaTtc, vatRate, purchases) => {
  const caHt=toHT(budgetCaTtc,vatRate); if(!caHt) return null; return (caHt-Number(purchases||0))/caHt;
};
export const purchasesToActualSalesRate = (actualCaTtc, vatRate, purchases) => {
  const caHt=toHT(actualCaTtc,vatRate); if(!caHt) return null; return Number(purchases||0)/caHt;
};
export const monthCommercialMargin = ({salesTtc,vatRate,openingStockHt,purchasesHt,closingStockHt}) => {
  const salesHt=toHT(salesTtc,vatRate); const cogs=round2(Number(openingStockHt||0)+Number(purchasesHt||0)-Number(closingStockHt||0));
  const margin=round2(salesHt-cogs); return {salesHt,cogs,margin,marginRate:salesHt?margin/salesHt:null};
};
export function daysInMonth(year,month){return new Date(year,month,0).getDate()}
export function isoDateLocal(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
export function addDays(iso,delta){const [y,m,d]=iso.split('-').map(Number);const x=new Date(y,m-1,d);x.setDate(x.getDate()+delta);return isoDateLocal(x)}
export function weekdayIndex(iso){const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d).getDay()}

function easterSunday(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);const month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
export function frenchPublicHolidays(year){
  const easter=easterSunday(year);
  return [
    {date:`${year}-01-01`,key:'new-year',name:"Jour de l'An"},
    {date:addDays(easter,1),key:'easter-monday',name:'Lundi de Pâques'},
    {date:`${year}-05-01`,key:'labour-day',name:'Fête du Travail'},
    {date:`${year}-05-08`,key:'victory-day',name:'8 Mai'},
    {date:addDays(easter,39),key:'ascension',name:'Ascension'},
    {date:addDays(easter,50),key:'pentecost-monday',name:'Lundi de Pentecôte'},
    {date:`${year}-07-14`,key:'bastille-day',name:'14 Juillet'},
    {date:`${year}-08-15`,key:'assumption',name:'Assomption'},
    {date:`${year}-11-01`,key:'all-saints',name:'Toussaint'},
    {date:`${year}-11-11`,key:'armistice',name:'11 Novembre'},
    {date:`${year}-12-25`,key:'christmas',name:'Noël'}
  ];
}
export function operationalDayWeight({date,weekdayWeights,holidayRules}){
  const dow=weekdayIndex(date); let weight=Number(weekdayWeights?.[dow] ?? 1);
  if(!holidayRules)return weight;
  const year=Number(date.slice(0,4));const holidays=frenchPublicHolidays(year);const holiday=holidays.find(h=>h.date===date);
  if(holiday){
    if((holidayRules.closedHolidayKeys||[]).includes(holiday.key))return 0;
    if(dow>=1&&dow<=4&&holidayRules.mondayToThursdayMode==='sunday-like')weight=Number(weekdayWeights?.[0] ?? 1);
    else if(dow===5||dow===6)weight*=Number(holidayRules.fridaySaturdayClosingFactor ?? 1);
  }
  if(!holiday){
    for(const h of holidays){
      const hdow=weekdayIndex(h.date);if(hdow<1||hdow>4)continue;
      if(date===addDays(h.date,-1))weight*=Number(holidayRules.preHolidayFactor ?? 1);
      if(date===addDays(h.date,1))weight*=Number(holidayRules.postHolidayFactor ?? 1);
    }
  }
  return weight;
}
export function dailyBudgetFromMonthly({year,month,date,monthlyBudget,weekdayWeights,holidayRules}){
  if(!monthlyBudget) return 0; const count=daysInMonth(year,month); let totalW=0;
  for(let d=1;d<=count;d++){const iso=`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;totalW+=operationalDayWeight({date:iso,weekdayWeights,holidayRules})}
  const w=operationalDayWeight({date,weekdayWeights,holidayRules}); return totalW?round2(Number(monthlyBudget)*w/totalW):0;
}
export function pct(n){return n==null?'—':`${(n*100).toFixed(1).replace('.',',')} %`}
export function recommendationEngine({entries,budgets,marginRates={},department,nowIso}){
  const recos=[]; const recent=[...entries].filter(e=>e.date<=nowIso).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
  if(!recent.length){return [{severity:'info',title:'Pas encore assez de données',text:'Commencez par enregistrer les achats quotidiens et le CA de J-1. Les préconisations se préciseront automatiquement.'}]}
  const missing=recent.filter(e=>(e.date<nowIso&&e.actual_ca_ttc==null) || e.purchase_ht_ex_promo==null || e.promo_purchase_ht==null).length;
  if(missing>=3) recos.push({severity:'medium',title:'Complétude des saisies',text:`${missing} journée(s) récente(s) sont incomplètes. Complétez-les pour fiabiliser les comparaisons et les préconisations.`});
  let overs=0, comparable=0, caUnder=0, caCount=0, oversValue=0;
  for(const e of recent){const b=budgets[e.date];if(!b)continue;const max=purchaseBudgetMax(b,department.vat_rate,marginRates[e.date] ?? department.target_margin_rate);const p=purchaseTotal(e);if(max!=null){comparable++;if(p>max){overs++;oversValue+=p-max}}if(e.actual_ca_ttc!=null&&b>0){caCount++;if(e.actual_ca_ttc < b*.9)caUnder++}}
  if(comparable>=5 && overs/comparable>=.3) recos.push({severity:'high',title:'Achats régulièrement au-dessus du budget',text:`${overs} jour(s) sur ${comparable} dépassent le budget d'achat calculé, pour environ ${round2(oversValue)} € HT de dépassement cumulé. Vérifiez les commandes, promotions et éventuels décalages de livraison.`});
  if(caCount>=5 && caUnder/caCount>=.35) recos.push({severity:'medium',title:'CA inférieur au budget',text:`Le CA réalisé est inférieur d'au moins 10 % au budget sur ${caUnder} jour(s) parmi ${caCount}. Il peut être pertinent d'ajuster les prochains achats avant de toucher aux objectifs annuels.`});
  const byDow=Array.from({length:7},()=>({ratios:[]}));for(const e of recent){const b=budgets[e.date];if(b&&e.actual_ca_ttc>0)byDow[weekdayIndex(e.date)].ratios.push(e.actual_ca_ttc/b)}
  const labels=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  byDow.forEach((x,i)=>{if(x.ratios.length>=3){const avg=x.ratios.reduce((a,b)=>a+b,0)/x.ratios.length;if(avg>1.12)recos.push({severity:'info',title:`${labels[i][0].toUpperCase()+labels[i].slice(1)} plus fort que prévu`,text:`Sur les dernières semaines comparables, le ${labels[i]} réalise en moyenne ${(avg*100-100).toFixed(0)} % de plus que son budget journalier. Vous pourrez augmenter son poids dans la répartition mensuelle si la tendance se confirme.`});if(avg<.88)recos.push({severity:'info',title:`${labels[i][0].toUpperCase()+labels[i].slice(1)} plus faible que prévu`,text:`Sur les dernières semaines comparables, le ${labels[i]} réalise en moyenne ${(100-avg*100).toFixed(0)} % de moins que son budget journalier. Une baisse de son poids peut rendre le budget quotidien plus réaliste.`})}});
  if(!recos.length)recos.push({severity:'info',title:'Pilotage cohérent',text:'Aucune dérive importante n’est détectée sur les données disponibles. Continuez les saisies quotidiennes pour consolider les tendances.'});
  return recos.slice(0,6);
}
