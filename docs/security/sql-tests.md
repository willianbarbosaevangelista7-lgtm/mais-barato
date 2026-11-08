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
