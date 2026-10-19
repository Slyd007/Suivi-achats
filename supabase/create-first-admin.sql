-- 1) Dans Supabase > Authentication > Users, créez d'abord votre utilisateur Direction.
-- 2) Copiez son UUID puis remplacez YOUR_AUTH_USER_UUID ci-dessous.
-- 3) Exécutez uniquement cette instruction.

insert into public.profiles(user_id,store_id,department_id,display_name,role)
values(
  'YOUR_AUTH_USER_UUID'::uuid,
  '11111111-1111-1111-1111-111111111111',
  null,
  'Direction',
  'admin'
)
on conflict (user_id) do update set display_name=excluded.display_name, role='admin', department_id=null;
