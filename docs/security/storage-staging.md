# Executar a integração do Storage em staging

O teste `bun run test:storage` cria e remove dados temporários no bucket `product-images` e na tabela `products`. **Nunca execute contra produção.** Use um projeto Supabase de staging descartável, com as migrações do branch aplicadas.

## Preparar as contas

No projeto de staging:

1. Crie um mercado de teste e anote seu ID.
2. Crie uma conta de parceiro com papel `market` e associação ao mercado de teste.
3. Crie uma conta separada com papel `customer`, sem papéis administrativos ou de mercado.
4. Confirme que o bucket `product-images` está privado.
5. Aplique as migrações Drizzle do branch até a última versão.

As duas contas devem ser exclusivas para teste. O teste cria três produtos temporários (aprovado, pendente e rejeitado), uploads, URLs assinadas e objetos de teste; ao final, tenta remover todos os dados criados.

## Configurar GitHub Actions

Crie o ambiente GitHub chamado `staging` em **Settings → Environments** e cadastre nele estes secrets:

- `SUPABASE_STORAGE_TEST_URL`
- `SUPABASE_STORAGE_TEST_ANON_KEY`
- `SUPABASE_STORAGE_TEST_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_TEST_EDITOR_EMAIL`
- `SUPABASE_STORAGE_TEST_EDITOR_PASSWORD`
- `SUPABASE_STORAGE_TEST_MARKET_ID`
- `SUPABASE_STORAGE_TEST_CUSTOMER_EMAIL`
- `SUPABASE_STORAGE_TEST_CUSTOMER_PASSWORD`

A chave service-role tem privilégio elevado: mantenha-a somente nos secrets do ambiente, nunca no repositório, em issues ou no chat.

## Executar

1. Abra **Actions → Storage staging integration**.
2. Selecione **Run workflow** na branch `security/fix-admin-bootstrap-public-catalog`.
3. Abra os logs e confirme que todas as verificações aparecem como `PASS`.

O workflow é manual e aponta explicitamente para o ambiente `staging`. Não configure secrets de produção nesse ambiente. Se o teste falhar, preserve os logs, investigue os objetos de teste restantes e não libere a implantação até corrigir e repetir a execução.

## Cobertura

O teste verifica bucket privado, autenticação do parceiro e do cliente, leitura pública de imagem aprovada, bloqueio de imagens pendentes/rejeitadas, prévia de objeto órfão pelo próprio uploader, bloqueio de leitura por terceiros, rejeição de caminhos aninhados, bloqueio de upload/update/delete por cliente e update/delete pelo editor autorizado.
