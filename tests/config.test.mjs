import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window={};
const {FL_SALES_REFERENCE,STORE_SEASONALITY_REFERENCE}=await import('../js/config.js');

const sum=o=>Object.values(o).reduce((a,b)=>a+Number(b),0);

test('CA annuel FL 2025 est cohérent avec les 12 mois',()=>{
  assert.ok(Math.abs(sum(FL_SALES_REFERENCE.actual2025)-FL_SALES_REFERENCE.annual2025)<0.01);
});

test('projection FL 2026 = réalisé Jan-Sept + prévision Q4',()=>{
  const projected=sum(FL_SALES_REFERENCE.actual2026)+sum(FL_SALES_REFERENCE.forecast2026);
  assert.ok(Math.abs(projected-FL_SALES_REFERENCE.projectedAnnual2026)<0.01);
});

test('projection Q4 applique 6,5 % au même mois 2025',()=>{
  for(const month of [10,11,12]){
    const expected=Math.round(FL_SALES_REFERENCE.actual2025[month]*(1+FL_SALES_REFERENCE.forecastGrowthQ4)*100)/100;
    assert.equal(FL_SALES_REFERENCE.forecast2026[month],expected);
  }
});

test('profil BDS garde samedi plus fort et dimanche plus faible',()=>{
  const w=STORE_SEASONALITY_REFERENCE.weekdayWeights;
  assert.equal(w.length,7);
  assert.ok(w[6]>w[5] && w[5]>w[1]);
  assert.ok(w[0]<w[1]);
});
