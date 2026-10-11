# Plano de migração do MaisBarato para um banco compartilhado

Este documento é só um plano. Nada será alterado, conectado ou apagado nesta etapa.

## 1. Opção recomendada: Lovable Cloud

O Lovable Cloud usa a mesma tecnologia do Supabase (banco Postgres, login e regras de segurança no banco), mas é ativado direto pelo editor, sem criar conta externa nem configurar chaves. É a opção mais simples para começar. Se um dia vocês precisarem de um Supabase próprio, o modelo de dados abaixo continua valendo.

## 2. Como o código funciona hoje e o que muda

- `src/lib/store.ts` guarda o catálogo e a lista no armazenamento do navegador. As telas leem os dados com `useCatalog()` e `useList()`, de forma imediata (síncrona).
- `src/lib/repository.ts` define o `CatalogRepository` (saveMarket, saveProduct, savePrice, saveOffer, removeOffer, reset). Todas as gravações passam por `catalogRepo`.
- As leituras **não** passam pelo repositório: as telas leem direto de `useCatalog()`. Esse é o principal ponto de mudança.

O que será trocado:
1. Os métodos do `CatalogRepository` passam a retornar `Promise<void>` (gravação assíncrona), e o repositório ganha um método de leitura, `loadCatalog(): Promise<Catalog>`.
2. Será criado um `cloudCatalogRepository` que lê e grava no banco usando o cliente gerado. O `localCatalogRepository` continua existindo como alternativa offline e para os testes.
3. `useCatalog()` mantém o mesmo formato (`Catalog`), mas passa a buscar os dados com TanStack Query (`queryKey: ["catalog"]`). Depois de cada gravação, o cache é atualizado (invalidado). Por isso, busca, comparação e lista não mudam por dentro, porque continuam recebendo um `Catalog`.
4. Os cálculos em `src/lib/pricing.ts` (`analyzeList`, `comparable` e outros) continuam iguais, porque já trabalham sobre o `Catalog` em memória.
5. A lista de compras fica no navegador para quem não fez login. Para quem fez login, fica na tabela `shopping_list_items`. As duas versões usam a mesma interface `listActions`.

## 3. Estrutura das tabelas

```text
auth.users (gerenciada pelo Cloud)
  └─ profiles (id = user_id, display_name)
  └─ user_roles (user_id, role: admin | market | customer)
  └─ market_members (user_id, market_id)       -> quais mercados cada usuário gerencia
markets (id, name, neighborhood, address, is_demo, created_by, created_at)
products (id, name, brand, category, size, unit, emoji, group_key, is_demo)
   unique (lower(name), lower(brand), size, unit)
prices (product_id FK, market_id FK, price numeric(10,2) > 0,
        updated_at date, updated_by, PK(product_id, market_id))
offers (id, product_id FK, market_id FK, price > 0, valid_until date,
        unique(product_id, market_id), check: preço da oferta < preço normal, via trigger)
shopping_list_items (user_id, product_id, qty >= 1, bought, PK(user_id, product_id))
```

- Os papéis (perfis de acesso) ficam numa tabela própria, `user_roles`, e nunca no perfil do usuário. A verificação é feita pela função `has_role(uid, role)` com `security definer`.
- A função `is_market_member(uid, market_id)` informa se um usuário pode gerenciar um mercado.
- Os produtos são compartilhados entre mercados, como já acontece hoje. Preços e ofertas pertencem a um mercado específico.

## 4. Login e permissões

| Perfil | Pode fazer |
|---|---|
| Visitante (sem login) | Ver mercados, produtos, preços e ofertas. Usar a lista no navegador. |
| Cliente | O mesmo que o visitante, com a lista salva na conta e disponível em qualquer aparelho. |
| Supermercado | Editar os dados do próprio mercado e os preços e ofertas dele. Criar produtos. |
| Administrador | Gerenciar tudo, ligar usuários a mercados e definir papéis. |

- Login por e-mail e senha (gratuito). Login com Google pode entrar depois.
- O cadastro cria o usuário como `customer`. Só o administrador promove alguém a `market` e o liga a um mercado. Assim ninguém consegue se declarar dono de um mercado.
- Na tela "Mercados" (`/supermercados`), o formulário só aparece para quem é supermercado ou administrador. As outras pessoas veem um pedido para entrar na conta.

## 5. Regras de segurança no banco

- Todas as tabelas terão a segurança por linha (RLS) ativada e permissões (grants) explícitas.
- `markets`, `products`, `prices` e `offers`: qualquer pessoa pode ler, inclusive sem login.
- `prices` e `offers`: inserir, alterar e apagar só com `is_market_member(auth.uid(), market_id) OR has_role(auth.uid(),'admin')`, aplicado tanto à linha atual quanto à nova. Isso impede que um mercado altere os preços de outro ou mude o `market_id` de um preço.
- `markets`: só o administrador cria mercados. Quem é membro do mercado pode alterar os dados dele.
- `products`: quem é supermercado ou administrador pode inserir. Só o administrador pode alterar ou apagar, para evitar que um mercado mude um produto usado por outros.
- `shopping_list_items`: cada pessoa só acessa os próprios itens (`auth.uid() = user_id`).
- `user_roles` e `market_members`: só o administrador grava. Cada pessoa pode ler os próprios registros.
- Validações também no banco, além das que já existem nos formulários: preço maior que zero, data de atualização não futura e oferta mais barata que o preço normal, com validade igual ou posterior a hoje (via trigger).

## 6. Dados de demonstração

- Os 4 mercados, 15 produtos, preços e 3 ofertas de `demo-data.ts` entram no banco por um script de inserção com `is_demo = true`. Os nomes atuais já indicam "fictício".
- O aviso amarelo e a etiqueta "Demo" continuam aparecendo sempre que `is_demo` for verdadeiro.
- O botão "Restaurar dados de demonstração" passa a ser só do administrador e restaura apenas os registros demo. Dados reais nunca são apagados.
- Os cadastros que cada pessoa fez no próprio navegador não são enviados sozinhos. Opcionalmente, um botão "Enviar meus cadastros locais", só para supermercado ou administrador, pode importá-los após confirmação.
- A lista de compras local é copiada para a conta no primeiro login, somando as quantidades, e não é apagada do navegador.
- `demo-data.ts` continua no código como cópia de segurança e como dado para os testes.

## 7. Telas e operações que passam a ser assíncronas

| Tela / arquivo | O que muda |
|---|---|
| `index.tsx` (Início) | Ler ofertas e mercados com indicador de carregamento. |
| `busca.tsx` | Ler o catálogo com carregamento. Filtros e busca continuam no próprio aparelho. |
| `comparar.tsx` | Ler o catálogo com carregamento. Página "não encontrado" se o produto não existir. |
| `lista.tsx` | Ler o catálogo. As ações de adicionar, remover, alterar quantidade, marcar e limpar ficam assíncronas para quem está logado, com atualização imediata na tela. |
| `ProductCard.tsx` | O botão "Adicionar à lista" fica assíncrono e mostra erro com aviso (toast). |
| `supermercados.tsx` | saveMarket, saveItem (produto, preço e oferta), removeOffer e reset ficam assíncronos. Botões desativados enquanto salva e mensagens de erro do banco em português. |
| `AppShell.tsx` | Botões Entrar/Sair e contador da lista. |
| Novas telas | `/auth` (entrar e cadastrar) e área protegida para os mercados. |

O `saveItem` grava produto, preço e oferta em sequência. Para não deixar a gravação pela metade, isso vira uma única função no banco (`upsert_market_item`) que faz tudo de uma vez ou nada.

## 8. Custos e limites

Confirmado:
- Não é preciso criar conta externa nem configurar chaves.
- O login por e-mail e o banco já vêm incluídos no Lovable Cloud.
- O app não usa nenhuma API paga.

A verificar antes de ativar (os valores mudam e dependem do plano do workspace):
- Cota gratuita de uso do Cloud e o que é cobrado quando ela acaba (banco, armazenamento, tráfego, usuários ativos).
- Limite de tamanho do banco. O MaisBarato usa pouco: milhares de preços ocupam poucos MB.
- Limite de envio de e-mails de confirmação de cadastro no domínio padrão.
- Se o projeto é pausado quando fica sem uso.
- Para comparar com Supabase próprio: o plano gratuito tinha historicamente 500 MB de banco, 50 mil usuários ativos por mês e pausa após 7 dias sem uso. Esses números precisam ser confirmados no site oficial.

Para baixar custos: sem fotos (os emojis continuam), sem atualizações em tempo real nesta fase e leitura do catálogo com cache.

## 9. Etapas de implementação

1. Ativar o Lovable Cloud.
2. Criar as tabelas, funções, regras de segurança e permissões, e inserir os dados demo.
3. Deixar o repositório assíncrono e criar o `cloudCatalogRepository`. Trocar o `useCatalog` para TanStack Query.
4. Adaptar as telas da seção 7: carregamento, erros e botões desativados.
5. Criar o login (`/auth`), os papéis, a proteção da área dos mercados e uma tela simples do administrador para ligar usuários a mercados.
6. Levar a lista de compras para a conta, com cópia da lista local no primeiro login.
7. Rodar a varredura de segurança e os testes abaixo. Atualizar AGENTS.md.

## 10. Testes

- Dois usuários veem os mesmos preços: o supermercado A muda o preço do arroz em um navegador. Em outro navegador anônimo, sem login, a busca e a comparação mostram o novo preço e a nova data.
- Isolamento entre mercados: o usuário do mercado A tenta gravar um preço do mercado B pelo app e direto pela API. As duas tentativas devem ser recusadas.
- Cliente sem permissão: um cliente tenta gravar preço ou oferta e a gravação é recusada. O formulário nem aparece para ele.
- Visitante: consegue ler tudo, mas não consegue gravar.
- Lista: cada usuário vê só a própria lista. A lista local passa para a conta no login. Os totais continuam batendo com os testes atuais (por exemplo, R$ 37,38).
- Validações no banco: oferta mais cara que o preço normal, data futura e preço zero são recusados.
- Dados demo: o restaurar só mexe nos registros demo, e os avisos de dados fictícios continuam aparecendo.
- Testes automáticos com vitest para `pricing.ts` e roteiro Playwright com dois navegadores separados.

## 11. Riscos

- **Leitura imediata vira assíncrona:** podem aparecer telas vazias ou piscando. Para evitar, carregar os dados antes da tela e mostrar indicador de carregamento.
- **Gravação pela metade em produto, preço e oferta:** resolvida com a função única no banco.
- **Produtos duplicados criados por mercados diferentes:** controlada com a regra de nome, marca e tamanho únicos.
- **Quem pode se tornar supermercado:** só o administrador promove, e o primeiro administrador é definido manualmente.
- **Catálogo inteiro carregado de uma vez:** serve para o teste no bairro, mas com milhares de produtos será preciso paginar ou buscar no servidor.
- **Confirmação de e-mail:** pode atrasar o cadastro nos testes. Decidir antes se fica ligada.
- **Custos e limites do plano gratuito:** precisam ser confirmados antes do lançamento (seção 8).
