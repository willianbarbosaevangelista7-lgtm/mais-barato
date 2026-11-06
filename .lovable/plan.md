# Central de Cadastro Inteligente de Produtos e Preços

Nada é apagado nem recriado. Tudo o que existe (busca, comparação, lista, busca por foto, leitor de código, fotos, login e permissões) continua funcionando.

## 1. Como o banco está hoje

| Já existe | Situação |
|---|---|
| Produtos (`products`) com código de barras único | Base pronta para o cadastro único por EAN |
| Vários supermercados (`markets`) | Pronto |
| Mesmo produto em vários mercados (`prices` por produto + mercado) | Pronto |
| Leitor de código pela câmera | Pronto (reaproveitado) |
| Fotos privadas de produtos | Pronto (reaproveitado) |
| Papéis admin / supermercado / cliente e vínculo conta-mercado | Pronto |
| Salvamento atômico produto + preço + oferta | Pronto |
| Data do preço | Só a data, sem horário nem origem |
| Histórico de preços | Não existe (cada atualização sobrescreve) |
| Aprovação de cadastros | Não existe (tudo publica na hora) |
| Importação Excel/CSV, foto de etiqueta, relatórios | Não existem |

## 2. Alterações no banco (somente adições)

- **Preços (`prices`)**: novas colunas `recorded_at` (data e horário), `source` (manual, escaneamento, importação, foto de etiqueta, administrador) e `updated_by`. A data atual continua preenchida.
- **Histórico (`price_history`)**: cada mudança de preço gera uma linha automaticamente (preço anterior, novo, data/hora, origem, quem alterou). Gravado por gatilho no banco, então nenhuma tela consegue pular o registro. Os preços atuais viram o primeiro registro do histórico.
- **Status de produto (`products.status`)**: `approved` (padrão — todos os existentes ficam aprovados), `pending`, `rejected`. A busca pública passa a mostrar apenas aprovados.
- **Lotes de importação (`import_batches`)**: quem enviou, mercado, tipo (Excel, CSV, foto de etiqueta), status (em revisão, publicado, descartado), contagens.
- **Linhas em revisão (`import_rows`)**: cada linha do arquivo/foto com EAN, nome, marca, categoria, tamanho, preço, oferta, resultado da validação (ok / aviso / erro), produto encontrado pelo EAN e ação (atualizar preço, criar produto, ignorar). Nada aqui aparece para consumidores.
- **Função `publish_import_batch`**: publica só as linhas válidas de uma vez, reutilizando a regra de salvamento atual (sem duplicar produtos: se o EAN existe, só atualiza o preço).
- **Permissões**: supermercado só vê e publica lotes do próprio mercado; admin vê tudo; clientes não acessam. Produtos novos criados por supermercado entram como `pending` até o admin aprovar; preços de produtos já aprovados publicam após a revisão do próprio mercado.

## 3. Fluxos

**Importação Excel/CSV (sempre com validação antes de publicar)**
1. Baixar modelo de planilha (EAN, nome, marca, categoria, tamanho, unidade, preço, preço de oferta, validade).
2. Enviar arquivo → leitura no aparelho → linhas gravadas como lote "em revisão".
3. Tela de revisão: verifica dígito do EAN, preço > 0, oferta menor que o preço, validade, categoria existente, duplicatas no próprio arquivo; mostra se o produto já existe e a variação do preço (alerta acima de 50%).
4. Corrigir ou ignorar linhas → "Publicar". Só então os consumidores veem.

**Foto de produto ou etiqueta com IA**
- Tirar/escolher foto da etiqueta de preço → IA sugere EAN, nome, marca, tamanho e preço → vira linha de revisão no mesmo fluxo acima (nunca publica direto).

**Cadastro rápido por supermercado**
- Tela "Atualizar preços": escanear EAN pela câmera ou digitar → produto encontrado aparece com preço atual → digitar novo preço → salvar (origem "escaneamento" ou "manual"). EAN desconhecido abre cadastro de produto (fica pendente).

**Menor preço**
- Já calculado na comparação; passa a usar só produtos aprovados e exibir também "atualizado em dd/mm às hh:mm" e a origem.

## 4. Novas telas (mesmo visual atual)

- **Mercados → Central do parceiro** (só contas ligadas a mercado): Atualizar preços (rápido), Importar planilha, Foto de etiqueta, Meus lotes, Histórico dos meus preços.
- **Mercados → Painel administrativo** (só admin): Produtos pendentes (aprovar, editar, rejeitar, remover), todos os lotes, vínculos conta-mercado (já existe; ganha botão "desligar"), remover cadastros.
- **Relatórios** (admin; mercado vê os seus): produtos cadastrados por status/setor, preços atualizados por período e por mercado, ofertas vencidas, preços sem atualização há mais de 30 dias. Exportação em CSV.
- **Comparação**: link "Ver histórico de preço" do produto.

## 5. Detalhes técnicos

- Leitura de Excel/CSV no navegador com a biblioteca `xlsx` (gratuita); limite de 2.000 linhas por lote.
- Reconhecimento de etiqueta: função de servidor com o AI Gateway, mesma base da busca por foto, com resposta validada (Zod); foto descartada após a leitura.
- Remover produto: admin pode remover; se já tiver preços, ele é marcado como rejeitado (oculto) em vez de apagado, preservando histórico.
- Todas as gravações continuam passando por `catalogRepo`; `useCatalog` continua com a mesma chave.
- Testes vitest: validação de linhas de importação (EAN, preço, oferta), detecção de duplicatas, e "atualizar sem duplicar". Testes no banco: mercado não publica lote de outro mercado, cliente não acessa lotes, histórico gerado a cada mudança.

## 6. Etapas

1. Banco: colunas, histórico com gatilho, status, lotes, função de publicação e permissões.
2. Cadastro rápido por EAN + exibição de data/hora/origem.
3. Importação Excel/CSV com tela de revisão.
4. Foto de etiqueta com IA no mesmo fluxo de revisão.
5. Painel administrativo (aprovações, edição, remoção, desligar vínculo).
6. Relatórios e histórico.
7. Testes, varredura de segurança e AGENTS.md.

## 7. Riscos

- Leitura de fotos de etiqueta pode errar preço: por isso sempre passa pela revisão.
- Planilhas grandes no celular podem ficar lentas: limite por lote.
- Catálogo continua carregado inteiro; com muitos milhares de produtos será preciso paginar.
