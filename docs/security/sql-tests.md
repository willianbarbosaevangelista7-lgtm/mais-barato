# Testes SQL de segurança

O MaisBarato mantém as migrações SQL em `drizzle/migrations`. Os testes pgTAP ficam em
`supabase/tests`. Não copie as migrações para `supabase/migrations`: isso criaria duas
fontes de verdade e poderia fazer a mesma alteração ser aplicada duas vezes.

## Pré-requisitos

- Docker em execução.
- Supabase CLI.
- PostgreSQL client (`psql`).
- `jq`.

## Executar localmente

Na raiz do repositório:

```bash
bash scripts/test-security-db.sh
```

O script:

1. Inicia a stack Supabase local.
2. Executa `supabase db reset --local`, recriando o banco local descartável.
3. Garante que pgTAP esteja disponível no schema `extensions`.
4. Lê `drizzle/migrations/meta/_journal.json` e aplica cada arquivo SQL na ordem de `idx`.
5. Executa `supabase test db`, que roda os arquivos em `supabase/tests`.

A URL padrão é `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
É possível sobrescrevê-la com `LOCAL_DATABASE_URL`, mas o script rejeita URLs que não
apontem para localhost na porta 54322.

## Segurança e dados

**Atenção:** `supabase db reset --local` apaga os dados do banco Supabase local e o recria.
Use somente no ambiente local descartável de testes. O script não usa URL hospedada, segredo
de produção nem aplica migrações no Supabase remoto.

A stack permanece em execução ao final para permitir inspeção. Para encerrá-la:

```bash
supabase stop
```

## Integração contínua

O workflow `.github/workflows/security-sql-tests.yml` executa a mesma rotina em pull requests
para `main` quando houver mudanças nas migrações, testes ou no próprio runner.

## Fonte de verdade e manutenção

- A ordem de aplicação é a ordem crescente de `entries[].idx` no journal do Drizzle.
- Cada `tag` precisa corresponder a um arquivo `drizzle/migrations/<tag>.sql`.
- Migrações novas devem ser registradas no journal pelo fluxo normal do Drizzle.
- Os testes pgTAP devem permanecer em `supabase/tests`.

O runner não usa `drizzle-kit migrate` porque o banco de testes precisa receber também as
migrações SQL manuais que fazem parte do journal. Ele aplica os arquivos versionados em ordem,
sem gerar ou alterar SQL.


## Teste de integração do Storage (staging)

O teste `scripts/test-storage-integration.mjs` valida o fluxo HTTP real do Supabase Storage,
além das políticas SQL verificadas pelo pgTAP. Ele cria três produtos temporários (aprovado,
pendente e rejeitado), envia uma imagem PNG para cada um, associa os caminhos aos produtos e
verifica a emissão e o download de URLs assinadas.

Também verifica que:
- o bucket `product-images` permanece privado;
- visitantes anônimos conseguem assinar e baixar somente a imagem aprovada;
- URLs públicas diretas não baixam nenhuma das imagens;
- o parceiro/editor que enviou as imagens consegue gerar URLs assinadas para os três estados;
- opcionalmente, um cliente autenticado consegue ver a aprovada, mas não as pendentes/rejeitadas
  e não consegue fazer upload;
- fixtures e objetos são removidos ao final, inclusive quando uma asserção falha.

### Preparação

Use **um projeto Supabase de staging descartável**, nunca produção. Crie previamente:
- uma conta de parceiro com papel `market` (ou uma conta admin dedicada a testes);
- associação dessa conta ao mercado de teste informado;
- opcionalmente, uma conta separada com papel `customer`;
- um bucket `product-images` já migrado e privado.

Instale as dependências do projeto (`bun install` ou `npm install`) e configure:

```bash
export SUPABASE_STORAGE_TEST_URL="https://SEU-PROJETO-STAGING.supabase.co"
export SUPABASE_STORAGE_TEST_ANON_KEY="SUA_CHAVE_PUBLICAVEL"
export SUPABASE_STORAGE_TEST_SERVICE_ROLE_KEY="SEGREDO_SERVICE_ROLE_DO_STAGING"
export SUPABASE_STORAGE_TEST_EDITOR_EMAIL="parceiro-teste@example.test"
export SUPABASE_STORAGE_TEST_EDITOR_PASSWORD="SENHA_DA_CONTA_DE_TESTE"
export SUPABASE_STORAGE_TEST_MARKET_ID="ID_DO_MERCADO_DE_TESTE"

# Recomendado para testar isolamento de cliente:
export SUPABASE_STORAGE_TEST_CUSTOMER_EMAIL="cliente-teste@example.test"
export SUPABASE_STORAGE_TEST_CUSTOMER_PASSWORD="SENHA_DO_CLIENTE"

export SUPABASE_STORAGE_TEST_TARGET="staging"
export SUPABASE_STORAGE_TEST_CONFIRM="I_UNDERSTAND_THIS_CREATES_AND_DELETES_TEST_DATA"
bun run test:storage
```

Para Supabase local, use `http://127.0.0.1:54321`; nesse caso o script não exige
`SUPABASE_STORAGE_TEST_TARGET=staging, mas mantém a confirmação explícita.

**Proteções:** o script recusa projetos remotos sem a confirmação explícita de staging e exige
uma segunda confirmação literal antes de criar dados. A chave service-role é usada somente
para preparar e limpar fixtures; nunca a coloque no frontend, no Git ou em logs. Use contas e
mercado exclusivos para teste. O script não cria usuários nem altera papéis/membros.

### Critérios de aprovação

A execução só passa se upload e leitura assinada funcionarem conforme o estado de moderação:
- anon: aprovado = permitido; pendente/rejeitado = negado;
- cliente autenticado: aprovado = permitido; pendente/rejeitado = negado;
- editor autorizado/uploader: os três estados = permitido;
- URL pública direta: os três estados = negado;
- upload: editor = permitido; cliente = negado.

O teste é destrutivo apenas para os IDs e caminhos únicos que ele próprio gera. Mesmo assim,
use staging isolado e confirme backup/ausência de dados reais antes da execução.
