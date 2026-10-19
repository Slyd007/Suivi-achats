-- Mise à jour Fruits & Légumes - saisonnalité BDS + budgets Q4 2026
-- À exécuter une seule fois sur une base déjà créée avec schema.sql.

update public.departments
set weekday_weights='[0.65,0.92,0.97,1.00,1.02,1.15,1.22]'::jsonb,
    updated_at=now()
where store_id='11111111-1111-1111-1111-111111111111'
  and code='FL';

insert into public.monthly_budgets(department_id,year,month,budget_ca_ttc,target_margin_rate,margin_source) values
('20000000-0000-0000-0000-000000000001',2026,10,26208.43,0.2870,'Projection FL 2026 · historique 2025 + tendance 2026'),
('20000000-0000-0000-0000-000000000001',2026,11,19680.58,0.2870,'Projection FL 2026 · historique 2025 + tendance 2026'),
('20000000-0000-0000-0000-000000000001',2026,12,27050.84,0.2870,'Projection FL 2026 · historique 2025 + tendance 2026')
on conflict (department_id,year,month) do update
set budget_ca_ttc=excluded.budget_ca_ttc,
    target_margin_rate=excluded.target_margin_rate,
    margin_source=excluded.margin_source,
    updated_at=now();
