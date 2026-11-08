# Inicialização segura do primeiro administrador

A migração `0006_secure_admin_bootstrap_and_public_catalog.sql` remove a promoção automática do primeiro usuário cadastrado. Novos cadastros recebem somente o papel `customer`; os papéis administrativos já existentes são preservados.

## Procedimento único para o primeiro administrador

1. O responsável pelo projeto deve criar a conta do administrador pelo fluxo normal de autenticação.
2. No painel do Supabase/Lovable Cloud, abra o SQL Editor com uma sessão administrativa confiável.
3. Substitua `admin@exemplo.com` pelo e-mail exato da conta que deve receber o papel.
4. Execute o bloco abaixo uma única vez. Ele falha se não encontrar exatamente uma conta ou se já existir um administrador.

```sql
DO $$
DECLARE
  target_user_id uuid;
  matching_users integer;
BEGIN
  SELECT count(*)
    INTO matching_users
    FROM auth.users
   WHERE lower(email) = lower(trim('admin@exemplo.com'));

  IF matching_users <> 1 THEN
    RAISE EXCEPTION 'Esperada exatamente uma conta para o e-mail informado; encontradas: %', matching_users;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Já existe um administrador. Não execute o bootstrap inicial.';
  END IF;

  SELECT id
    INTO target_user_id
    FROM auth.users
   WHERE lower(email) = lower(trim('admin@exemplo.com'));

  INSERT INTO public.user_roles(user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END
$$;
```

5. Confirme o resultado consultando `public.user_roles` no painel administrativo. Não exponha a chave `service_role` no navegador, no repositório ou em mensagens.

## Comportamento esperado após a migração

- Cadastro público: apenas `customer`.
- Administradores já existentes: permanecem administradores.
- Visitantes e clientes: leem somente produtos com `status = 'approved'`, e preços/ofertas/histórico associados a esses produtos.
- Usuários com papel de editor de catálogo: mantêm acesso a produtos pendentes/rejeitados para revisão.

## Validação antes de produção

- Aplicar a migração em ambiente de teste primeiro.
- Testar consultas REST/PostgREST como `anon`, cliente, parceiro/editor e administrador.
- Confirmar que produtos pendentes e rejeitados, seus preços, ofertas e histórico não são retornados para visitantes/clientes.
- Confirmar que produtos aprovados continuam visíveis publicamente.
- Criar uma conta nova e confirmar que ela recebe apenas `customer`.
- Confirmar que o administrador existente continua com o papel `admin`.

Esta migração não promove automaticamente nenhuma conta existente. O bootstrap acima é uma operação manual, privilegiada e deliberada.
