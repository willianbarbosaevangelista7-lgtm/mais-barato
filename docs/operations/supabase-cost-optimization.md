# Otimização de custos do Supabase

## Alterações aplicadas nesta branch

- O catálogo solicita somente as colunas usadas pela interface, em vez de transferir todas as colunas das quatro tabelas.
- O cache compartilhado do catálogo usa validade de 2 minutos e não dispara uma nova leitura apenas porque a aba recebeu foco. Ao montar uma tela após o cache vencer ou reconectar, o TanStack Query pode atualizar os dados.
- Fotos selecionadas são normalizadas no navegador para JPEG, lado maior de até 1.280 px e alvo máximo de 400 KB. A compressão reduz qualidade em etapas e, se necessário, reduz dimensões; falha de forma explícita se não conseguir respeitar o limite.
- O bucket `product-images` continua privado, aceita apenas `image/jpeg` e impõe limite de 1 MiB por objeto. O limite do bucket é uma segunda barreira, não substitui a validação no cliente nem as políticas RLS.
- Uploads usam caminhos com timestamp que não são sobrescritos e `cacheControl=31536000` (um ano), permitindo cache eficiente de objetos imutáveis.
- As URLs assinadas continuam sendo usadas para respeitar as políticas de leitura do bucket privado. A validade atual de 1 hora e o cache de consulta de 50 minutos foram preservados.

## Proteções preservadas

- Não tornar o bucket público: downloads continuam sujeitos às políticas RLS de `storage.objects`.
- Não alterar políticas de SELECT, INSERT, UPDATE ou DELETE do Storage, nem funções de identidade, associação ou moderação.
- Não alterar a visibilidade de produtos aprovados, pendentes ou rejeitados.
- Não remover nem reduzir o histórico de preços; ele é parte da comparação e auditoria.
- Não expor a chave secret no cliente, no código ou nos logs.

## Por que não foram adicionados índices indiscriminadamente

Índices aceleram leituras específicas, mas aumentam espaço ocupado e custo de escrita. Sem métricas reais de consultas e planos (`EXPLAIN (ANALYZE, BUFFERS)`), adicionar índices por suposição pode aumentar o custo total. Antes de qualquer índice adicional, medir as consultas mais caras e conferir os índices já existentes.

## Validação

- Testes unitários verificam a lista explícita de colunas, o prazo de cache e a conversão de imagem para JPEG dentro do limite.
- pgTAP verifica que o bucket permanece privado, com limite de 1 MiB e allowlist JPEG, além de manter as asserções RLS existentes.
- O teste HTTP de Storage em staging também tenta enviar um objeto PNG e espera rejeição.
- A integração HTTP real continua dependendo da configuração do ambiente GitHub `staging`; os testes de CI não substituem essa execução.

## Monitoramento após implantação

Compare, antes e depois, egress de Database/Storage, bytes médios por foto, quantidade de chamadas REST, crescimento de `price_history`, CPU, memória e latência. Não reduza o compute sem essas métricas.
