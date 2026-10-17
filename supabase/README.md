# Supabase

- `migrations/`: estrutura do banco, regras de acesso (RLS), funções seguras e avisos agendados.
- `functions/manage-users/`: Edge Function que cria contas, redefine senhas, ativa/desativa acessos e troca CPF.

## Criar a conta do administrador

As demais contas são criadas pelo próprio app. Só a primeira, a do administrador, precisa ser criada à mão: no painel do Supabase, abra o **SQL Editor** e rode o trecho abaixo, trocando o nome, o usuário e a senha provisória (com no mínimo 8 caracteres, letras e números).

```sql
do $$
declare
  v_id uuid := gen_random_uuid();
  v_user text := 'admin';                          -- usuário de login
  v_name text := 'Seu Nome';                       -- nome exibido
  v_pass text := 'troque-esta-senha-123';          -- senha provisória
  v_email text := v_user || '@equipe.escala-voluntarios.app';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_pass, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', v_email), 'email', now(), now(), now());
  insert into public.profiles (id, role, name, username, must_change_password)
  values (v_id, 'admin', v_name, v_user, true);
end $$;
```

Depois, entre no app pela aba **Coordenação** com esse usuário e essa senha. O app vai pedir que você crie uma senha definitiva.
