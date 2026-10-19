import {APP_CONFIG,PLACARD_REFERENCE,STORE_SEASONALITY_REFERENCE,FL_SALES_REFERENCE} from './config.js';
import {isoDateLocal} from './calculations.mjs';
const LS_KEY='suivi-achats-isigny-v1';
const uuid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const now=()=>new Date().toISOString();

function baseState(){
  const departments=APP_CONFIG.defaultDepartments.map((d,i)=>({
    id:`dept-${i+1}`,code:d.code,name:d.name,vat_rate:.055,
    target_margin_rate:PLACARD_REFERENCE.departments[d.code]?.net ?? null,
    weekday_weights:d.code==='FL'?[...STORE_SEASONALITY_REFERENCE.weekdayWeights]:[1,1,1,1,1,1,1]
  }));
  const budgets=departments.map(d=>({id:`placard-${d.id}-2026-08`,department_id:d.id,year:2026,month:8,budget_ca_ttc:0,target_margin_rate:d.target_margin_rate,margin_source:PLACARD_REFERENCE.label,updated_at:now()}));
  const fl=departments.find(d=>d.code==='FL');
  if(fl){for(const month of [10,11,12])budgets.push({id:`forecast-${fl.id}-2026-${month}`,department_id:fl.id,year:2026,month,budget_ca_ttc:FL_SALES_REFERENCE.forecast2026[month],target_margin_rate:fl.target_margin_rate,margin_source:'Projection CA FL 2026 · historique 2025 + tendance 2026',updated_at:now()})}
  return {mode:'local',seasonalityVersion:'bds-2025-v1',profile:{id:'local-admin',name:'Direction',role:'admin',department_id:null},departments,budgets,entries:[],audit:[],monthClose:[]};
}
function migrateLocal(raw){
  const base=baseState(); if(!raw||typeof raw!=='object')return base;
  const firstSeasonalityMigration=!raw.seasonalityVersion;
  raw.departments=(raw.departments||base.departments).map((d,i)=>{const def=APP_CONFIG.defaultDepartments[i]||{};const code=d.code||def.code;const fallbackWeights=code==='FL'?[...STORE_SEASONALITY_REFERENCE.weekdayWeights]:[1,1,1,1,1,1,1];return {...d,code,name:d.name||def.name,target_margin_rate:d.target_margin_rate ?? PLACARD_REFERENCE.departments[code]?.net ?? null,weekday_weights:firstSeasonalityMigration&&code==='FL'?[...STORE_SEASONALITY_REFERENCE.weekdayWeights]:(d.weekday_weights||fallbackWeights)}});
  raw.budgets=raw.budgets||[]; raw.entries=raw.entries||[]; raw.audit=raw.audit||[]; raw.monthClose=raw.monthClose||[];
  for(const d of raw.departments){if(!raw.budgets.some(b=>b.department_id===d.id&&b.year===2026&&b.month===8)){raw.budgets.push({id:`placard-${d.id}-2026-08`,department_id:d.id,year:2026,month:8,budget_ca_ttc:0,target_margin_rate:PLACARD_REFERENCE.departments[d.code]?.net ?? d.target_margin_rate ?? null,margin_source:PLACARD_REFERENCE.label,updated_at:now()})}}
  const fl=raw.departments.find(d=>d.code==='FL');
  if(fl){for(const month of [10,11,12])if(!raw.budgets.some(b=>b.department_id===fl.id&&b.year===2026&&b.month===month)){raw.budgets.push({id:`forecast-${fl.id}-2026-${month}`,department_id:fl.id,year:2026,month,budget_ca_ttc:FL_SALES_REFERENCE.forecast2026[month],target_margin_rate:PLACARD_REFERENCE.departments.FL.net,margin_source:'Projection CA FL 2026 · historique 2025 + tendance 2026',updated_at:now()})}}
  raw.seasonalityVersion='bds-2025-v1';
  return raw;
}
function loadLocal(){try{return migrateLocal(JSON.parse(localStorage.getItem(LS_KEY)))}catch{return baseState()}}
function saveLocal(s){localStorage.setItem(LS_KEY,JSON.stringify(s))}

export class DataStore{
  constructor(){this.configured=Boolean(APP_CONFIG.supabaseUrl&&APP_CONFIG.supabasePublishableKey);this.misconfigured=this.configured&&!window.supabase;this.cloud=this.configured&&Boolean(window.supabase);this.sb=this.cloud?window.supabase.createClient(APP_CONFIG.supabaseUrl,APP_CONFIG.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;this.state=loadLocal()}
  async init(){if(this.misconfigured)throw new Error('Supabase est configuré mais la bibliothèque de connexion n’a pas pu être chargée. Vérifiez la connexion Internet/CDN.');if(!this.cloud)return {mode:'local',profile:this.state.profile};const {data:{session}}=await this.sb.auth.getSession();if(!session)return {mode:'cloud',profile:null};return {mode:'cloud',profile:await this.fetchProfile()}}
  async login(email,password){if(!this.cloud)throw new Error('Mode local');const {error}=await this.sb.auth.signInWithPassword({email,password});if(error)throw error;return this.fetchProfile()}
  async logout(){if(this.cloud)await this.sb.auth.signOut()}
  async fetchProfile(){const {data:{user},error:userError}=await this.sb.auth.getUser();if(userError)throw userError;if(!user)throw new Error('Session utilisateur introuvable.');const {data,error}=await this.sb.from('profiles').select('user_id,display_name,role,department_id,store_id').eq('user_id',user.id).single();if(error)throw error;return {id:data.user_id,name:data.display_name||'Utilisateur',role:data.role,department_id:data.department_id,store_id:data.store_id}}
  async getDepartments(){if(!this.cloud)return this.state.departments;const {data,error}=await this.sb.from('departments').select('*').order('name');if(error)throw error;return data.map(d=>({...d,weekday_weights:d.weekday_weights||[1,1,1,1,1,1,1]}))}
  async updateDepartment(dept){if(!this.cloud){const i=this.state.departments.findIndex(x=>x.id===dept.id);this.state.departments[i]={...this.state.departments[i],...dept};saveLocal(this.state);return}const {error}=await this.sb.from('departments').update({target_margin_rate:dept.target_margin_rate,vat_rate:dept.vat_rate,weekday_weights:dept.weekday_weights}).eq('id',dept.id);if(error)throw error}

  async getBudgetsForYear(departmentId,year){if(!this.cloud)return this.state.budgets.filter(b=>b.department_id===departmentId&&b.year===year).sort((a,b)=>a.month-b.month);const {data,error}=await this.sb.from('monthly_budgets').select('*').eq('department_id',departmentId).eq('year',year).order('month');if(error)throw error;return data}
  async getBudget(departmentId,year,month){if(!this.cloud){return this.state.budgets.find(b=>b.department_id===departmentId&&b.year===year&&b.month===month)||null}const {data,error}=await this.sb.from('monthly_budgets').select('*').eq('department_id',departmentId).eq('year',year).eq('month',month).maybeSingle();if(error)throw error;return data}
  async upsertBudget(row){if(!this.cloud){const i=this.state.budgets.findIndex(b=>b.department_id===row.department_id&&b.year===row.year&&b.month===row.month);const x={...row,id:i>=0?this.state.budgets[i].id:uuid(),updated_at:now()};if(i>=0)this.state.budgets[i]=x;else this.state.budgets.push(x);saveLocal(this.state);return x}const {data,error}=await this.sb.from('monthly_budgets').upsert(row,{onConflict:'department_id,year,month'}).select().single();if(error)throw error;return data}
  async getEntries(departmentId,start,end){if(!this.cloud)return this.state.entries.filter(e=>e.department_id===departmentId&&e.date>=start&&e.date<=end).sort((a,b)=>a.date.localeCompare(b.date));let q=this.sb.from('daily_entries').select('*').eq('department_id',departmentId).gte('date',start).lte('date',end).order('date');const {data,error}=await q;if(error)throw error;return data}
  async getAllEntries(start,end){if(!this.cloud)return this.state.entries.filter(e=>e.date>=start&&e.date<=end);const {data,error}=await this.sb.from('daily_entries').select('*').gte('date',start).lte('date',end);if(error)throw error;return data}
  async upsertEntry(row,meta={}){if(!this.cloud){let i=this.state.entries.findIndex(e=>e.department_id===row.department_id&&e.date===row.date);const before=i>=0?structuredClone(this.state.entries[i]):null;const x={...(i>=0?this.state.entries[i]:{}),...row,id:i>=0?this.state.entries[i].id:uuid(),updated_at:now()};if(i>=0)this.state.entries[i]=x;else this.state.entries.push(x);this.state.audit.unshift({id:uuid(),department_id:row.department_id,date:row.date,action:i>=0?'UPDATE':'INSERT',changed_at:now(),changed_by:this.state.profile.name,before,after:x,source:meta.source||'app'});saveLocal(this.state);return x}const {data,error}=await this.sb.from('daily_entries').upsert(row,{onConflict:'department_id,date'}).select().single();if(error)throw error;return data}
  async saveDailyInput({departmentId,purchaseDate,salesDate,purchaseExPromo,promoPurchase,actualCaTtc}){const existingPurchase=(await this.getEntries(departmentId,purchaseDate,purchaseDate))[0]||{};await this.upsertEntry({department_id:departmentId,date:purchaseDate,purchase_ht_ex_promo:Number(purchaseExPromo),promo_purchase_ht:Number(promoPurchase),actual_ca_ttc:existingPurchase.actual_ca_ttc??null},{source:'daily-form'});const existingSales=(await this.getEntries(departmentId,salesDate,salesDate))[0]||{};await this.upsertEntry({department_id:departmentId,date:salesDate,purchase_ht_ex_promo:existingSales.purchase_ht_ex_promo??null,promo_purchase_ht:existingSales.promo_purchase_ht??null,actual_ca_ttc:Number(actualCaTtc)},{source:'daily-form'});}
  async getAudit(departmentId,limit=100){if(!this.cloud)return this.state.audit.filter(a=>!departmentId||a.department_id===departmentId).slice(0,limit);let q=this.sb.from('entry_audit').select('*').order('changed_at',{ascending:false}).limit(limit);if(departmentId)q=q.eq('department_id',departmentId);const {data,error}=await q;if(error)throw error;return data}
  async getMonthClose(departmentId,year,month){if(!this.cloud)return this.state.monthClose.find(x=>x.department_id===departmentId&&x.year===year&&x.month===month)||null;const {data,error}=await this.sb.from('month_closings').select('*').eq('department_id',departmentId).eq('year',year).eq('month',month).maybeSingle();if(error)throw error;return data}
  async upsertMonthClose(row){if(!this.cloud){const i=this.state.monthClose.findIndex(x=>x.department_id===row.department_id&&x.year===row.year&&x.month===row.month);if(i>=0)this.state.monthClose[i]={...this.state.monthClose[i],...row};else this.state.monthClose.push({...row,id:uuid()});saveLocal(this.state);return}const {error}=await this.sb.from('month_closings').upsert(row,{onConflict:'department_id,year,month'});if(error)throw error}
  async exportLocal(){return JSON.stringify(this.state,null,2)}
  async resetDemo(){this.state=baseState();saveLocal(this.state)}
}
