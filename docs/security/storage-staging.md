# Executar a integração do Storage em staging

O teste `bun run test:storage` cria e remove dados temporários no bucket `product-images`, em `storage.objects`, e na tabela `public.products` (com preços de fixture). **Nunca execute contra produção ou contra o banco conectado ao aplicativo público.** Use um projeto Supabase independente, descartável e exclusivo para validação.

O workflow não cria um projeto Supabase nem aplica migrações. Ele valida a configuração, autentica duas contas e executa operações reais de Storage contra o host de staging configurado.

## 1. Criar/preparar o projeto de staging

1. Crie um projeto Supabase separado do projeto usado pelo aplicativo publicado. Use um nome inequívoco, por exemplo `maisbarato-staging`.
2. Guarde a URL, a chave publishable e a chave secret desse projeto. Não use os valores do projeto de produção.
3. Aplique **uma única vez** as doze migrações `drizzle/migrations` do branch, em ordem pelo campo `idx` do `drizzle/migrations/meta/_journal.json`, até `0011_harden_market_write_identity.sql`. Use o processo de migração aprovado para o projeto; não reaplique migrações já executadas.
4. Confirme que as tabelas `products`, `prices`, `user_roles`, `market_members` e o bucket `product-images` existem. Confirme que o bucket está privado:

```sql
select id, name, public
from storage.buckets
where id = 'product-images';
```

O resultado esperado é uma linha com `public = false`.

## 2. Criar as duas contas de teste

Em **Authentication → Users**, crie duas contas de teste com senha:

- **Parceiro/editor:** conta independente que será vinculada ao mercado de teste.
- **Cliente:** conta independente sem papel `market`, sem papel `admin` e sem vínculo a qualquer mercado.

Copie os UUIDs dessas duas contas. Em **SQL Editor** do projeto de staging, substitua os dois marcadores no SQL abaixo pelos UUIDs reais. Esse SQL cria somente um mercado de teste e concede o papel/vínculo de parceiro à conta indicada:

```sql
insert into public.markets (id, name, neighborhood, address, is_demo)
values ('maisbarato-storage-staging', 'Mercado QA Storage MaisBarato', 'Staging', '', true)
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
values ('<UUID_DA_CONTA_PARCEIRO>'::uuid, 'market')
on conflict (user_id, role) do nothing;

insert into public.market_members (user_id, market_id)
values ('<UUID_DA_CONTA_PARCEIRO>'::uuid, 'maisbarato-storage-staging')
on conflict (user_id, market_id) do nothing;
```

A migração de autenticação atribui o papel `customer` aos novos cadastros. Confirme que a conta cliente tem esse papel e não tem papéis ou vínculos adicionais. Não transforme a conta cliente em admin ou parceiro.

## 3. Criar o ambiente GitHub e configurar os valores

No repositório, abra **Settings → Environments → New environment** e crie exatamente `staging`. Restrinja os deployments à branch `security/fix-admin-bootstrap-public-catalog` enquanto estiver testando.

Cadastre estes **Environment secrets** (todos precisam apontar para o projeto Supabase de staging):

- `SUPABASE_STORAGE_TEST_URL`
- `SUPABASE_STORAGE_TEST_PUBLISHABLE_KEY`
- `SUPABASE_STORAGE_TEST_SECRET_KEY`
- `SUPABASE_STORAGE_TEST_EDITOR_EMAIL`
- `SUPABASE_STORAGE_TEST_EDITOR_PASSWORD`
- `SUPABASE_STORAGE_TEST_MARKET_ID` — use `maisbarato-storage-staging`
- `SUPABASE_STORAGE_TEST_CUSTOMER_EMAIL`
- `SUPABASE_STORAGE_TEST_CUSTOMER_PASSWORD`

Cadastre também esta **Environment variable** (não é secret):

- `SUPABASE_STORAGE_TEST_EXPECTED_HOST` — somente o hostname da URL Supabase, sem `https://`, sem caminho e sem barra. Exemplo ilustrativo: `abcdefghijklmnopqrst.supabase.co`.

Use as chaves atuais do Supabase: publishable (`sb_publishable_...`) para os clientes de teste autenticados/visitante e secret (`sb_secret_...`) somente no cliente administrativo do runner. O preflight do workflow confirma que todos os oito secrets e a variável existem e que o hostname real da URL corresponde exatamente ao hostname aprovado. Nenhum valor secreto é impresso nos logs.

**A chave secret (`sb_secret_...`) é altamente privilegiada e pode ignorar RLS.** Ela deve existir somente como Environment secret do GitHub `staging` e ser usada apenas pelo runner no servidor; nunca a coloque no Git, em issues, nos logs ou no chat. Não configure secrets de produção nesse ambiente.

## 4. Executar o teste real

1. Abra **Actions → Storage staging integration**.
2. Selecione **Run workflow**.
3. Escolha a branch `security/fix-admin-bootstrap-public-catalog`.
4. Abra a execução e confirme que o preflight passou e que todas as verificações do script aparecem como `PASS`.
5. Confirme a linha final `Storage integration tests passed: N checks.` e verifique se não houve erros de limpeza (`Cleanup error`). O workflow falha quando a remoção dos dados temporários não é confirmada.

O workflow é manual, usa o ambiente `staging` e não executa migrações. Ele não deve receber dados do ambiente de produção. Se o teste falhar, preserve os logs, confira/remova manualmente eventuais fixtures que tenham sobrado em staging e corrija a causa antes de repetir.

## Cobertura

O teste verifica bucket privado, autenticação de parceiro e cliente, papel `market` e vínculo ao mercado, cliente sem privilégios/vínculos, leitura de imagem aprovada por visitante e cliente, bloqueio de imagem pendente/rejeitada para público/cliente, URL assinada e download, prévia de imagem órfã somente pelo uploader, bloqueio de caminho aninhado, bloqueio de upload/update/delete pelo cliente e update/delete pelo parceiro autorizado.

As imagens de fixture são JPEGs válidos e seguem o formato usado pela aplicação: `<product-id>/<timestamp>.jpg` com `contentType: image/jpeg`.
