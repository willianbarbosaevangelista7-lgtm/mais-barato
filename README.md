# MaisBarato

Aplicativo web responsivo, em português do Brasil, para comparar preços de supermercado e ajudar consumidores a economizar. O projeto é desenvolvido com Lovable, React, TypeScript, TanStack Start/Query e Lovable Cloud.

**Aplicação:** https://mais-barato.lovable.app  
**Editor Lovable:** https://lovable.dev/projects/f119ac18-9b03-40ab-97ee-4eabe732fd6b

## Funcionalidades

### Para consumidores
- Busca de produtos e comparação de preços entre mercados.
- Comparação de itens equivalentes e cálculo de preço por unidade de medida.
- Destaque do menor preço, ofertas válidas e data de atualização.
- Lista de compras com estimativa de total e economia potencial.
- Lista sincronizada à conta quando o usuário está autenticado.
- Leitor de código de barras e busca de produtos por foto com identificação assistida por IA.
- Histórico de preços disponível na comparação de produtos.
- Produtos pendentes ou rejeitados não aparecem no catálogo público.

### Para supermercados parceiros
- Atualização rápida de preços por EAN, com leitura pela câmera ou digitação.
- Cadastro compartilhado de produtos, evitando duplicação por código de barras.
- Importação de planilhas Excel/CSV com validação e revisão antes da publicação.
- Leitura assistida por IA de fotos de etiquetas; os dados extraídos também passam por revisão.
- Consulta aos lotes de importação e histórico de alterações.
- Relatórios de produtos, alterações de preço, ofertas vencidas e preços desatualizados.
- Controle de acesso por vínculo entre conta e supermercado.

### Para administradores
- Aprovação, edição, rejeição e remoção segura de produtos.
- Gerenciamento de vínculos entre contas e supermercados.
- Visão administrativa dos mercados e relatórios.

## Segurança e dados
- O catálogo compartilhado é armazenado no Lovable Cloud.
- As permissões são aplicadas no banco por RLS e funções de autorização; esconder botões na interface não substitui essas regras.
- As fotos de produtos ficam em bucket privado e são exibidas por URLs assinadas.
- Alterações de preços geram histórico no banco.
- Importações ficam em revisão e não são exibidas aos consumidores antes da publicação.
- Dados demonstrativos devem permanecer identificados como fictícios.
- Nunca envie arquivos .env, senhas, tokens privados ou chaves administrativas para o Git. Configure segredos no ambiente apropriado do Lovable/Cloud.

## Desenvolvimento

Requisitos: Node.js e Bun ou npm.

```sh
git clone https://github.com/willianbarbosaevangelista7-lgtm/mais-barato.git
cd mais-barato
bun install
bun run dev
```

Scripts disponíveis:

```sh
bun run build
bun run lint
bun run test
```

## Documentação do projeto
- AGENTS.md: regras importantes para alterações no projeto e integração com Lovable.
- roadmap.md: funcionalidades entregues e pendências conhecidas.
- .lovable/plan/: planos de arquitetura e evolução do produto.

## Cuidados ao contribuir
O repositório é conectado ao Lovable. Commits enviados à branch conectada sincronizam com o editor. Não reescreva o histórico já publicado (por exemplo, com force-push, rebase ou amend). Mantenha a branch principal funcional e respeite as regras de banco, autenticação e repositório descritas em AGENTS.md.