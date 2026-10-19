-- Modèle : créez l'utilisateur dans Authentication > Users, puis associez-le à un rayon.
-- Remplacez USER_UUID, DISPLAY_NAME et DEPARTMENT_UUID.
-- UUID rayons :
-- FL          20000000-0000-0000-0000-000000000001
-- Poisson     20000000-0000-0000-0000-000000000002
-- Charcuterie 20000000-0000-0000-0000-000000000003
-- Fromage     20000000-0000-0000-0000-000000000004
-- Boucherie   20000000-0000-0000-0000-000000000005
-- Volaille    20000000-0000-0000-0000-000000000006
-- PVP         20000000-0000-0000-0000-000000000007

insert into public.profiles(user_id,store_id,department_id,display_name,role)
values('USER_UUID'::uuid,'11111111-1111-1111-1111-111111111111','DEPARTMENT_UUID'::uuid,'DISPLAY_NAME','team')
on conflict (user_id) do update set department_id=excluded.department_id, display_name=excluded.display_name, role='team';
