# Mais Barato

Crie um aplicativo web responsivo chamado MaisBarato, em português do Brasil, para comparar preços de produtos de supermercado e ajudar as pessoas a economizar.



Objetivo: desenvolver um MVP funcional, priorizando ferramentas gratuitas, para testar inicialmente em um bairro da Zona Norte de São Paulo.



Identidade visual



- Cores: verde-escuro, verde-claro e branco.

- Design moderno, simples, intuitivo e acessível.

- Interface adaptada para celular e computador.

- Moeda em reais (R$).

- Textos em português brasileiro.



Crie cinco áreas principais:



1. Início: barra de pesquisa, ofertas do dia, mercados próximos e acesso à lista de compras.



2. Busca de produtos: mostrar nome, marca, quantidade, imagem ilustrativa e preços do mesmo produto em diferentes supermercados. Permitir ordenar pelo menor preço.



3. Comparação de preços: destacar o menor preço, mostrar a diferença em reais e porcentagem, informar a data da atualização e oferecer o botão “Adicionar à lista”.



4. Lista de compras: permitir adicionar, remover e marcar produtos como comprados. Calcular o total estimado, mostrar o mercado mais barato para cada item e apresentar a economia potencial. Comparar também o custo de comprar tudo em um único mercado com o de dividir a compra entre mercados, usando os preços disponíveis.



5. Área dos supermercados: criar uma interface de demonstração para cadastrar produtos, informar preços, criar ofertas e definir datas de validade.



Funcionalidades importantes



- Busca por nome do produto.

- Filtros por mercado e categoria.

- Comparação de produtos equivalentes, considerando marca, peso e volume.

- Carrinho ou lista de compras persistente durante a navegação.

- Dados de demonstração claramente identificados como fictícios.

- Data de atualização visível em cada preço.

- Não apresentar preços fictícios como se fossem ofertas reais.

- Não afirmar que existem mercados próximos sem dados de localização confiáveis.



Requisitos técnicos



- Construa uma aplicação funcional, e não apenas imagens estáticas.

- Utilize componentes reutilizáveis e código organizado.

- Comece com dados locais de demonstração, sem exigir serviços pagos ou chaves de API.

- Se necessário, utilize localStorage para preservar a lista no mesmo navegador.

- Não implemente login obrigatório nesta primeira versão.

- Deixe a arquitetura preparada para integrar futuramente um banco de dados e autenticação.

- Não invente integrações com supermercados ou atualizações automáticas de preços.



Primeira entrega: gere todas as cinco áreas navegáveis, com dados de demonstração, pesquisa funcional, comparação de preços, lista de compras com cálculo de totais e uma área demonstrativa para supermercados. Priorize uma experiência excelente no celular.



Antes de finalizar, teste a navegação, os cálculos, a pesquisa e a inclusão e remoção de produtos da lista.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mais-barato.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f119ac18-9b03-40ab-97ee-4eabe732fd6b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
