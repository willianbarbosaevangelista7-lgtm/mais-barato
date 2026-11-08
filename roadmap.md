# Roadmap do MaisBarato

## Entregue no código
- [x] Lovable Cloud: catálogo compartilhado, autenticação, papéis, vínculos e regras de acesso.
- [x] Busca, comparação de preços, ofertas e lista de compras.
- [x] Lista de compras sincronizada à conta, mantendo cópia de trabalho local.
- [x] Leitor de código de barras e entrada manual de EAN com validação.
- [x] Fotos de produtos com câmera/galeria, prévia, compressão e armazenamento privado.
- [x] Busca de produto por foto com identificação assistida por IA.
- [x] Redefinição de senha.
- [x] Central de cadastro para parceiros e administradores.
- [x] Atualização rápida de preços por EAN, com origem e horário registrados.
- [x] Histórico de alterações de preços no banco e consulta por produto.
- [x] Status de produto: aprovado, pendente e rejeitado; aprovação administrativa.
- [x] Importação Excel/CSV com modelo, limite por lote, validação, revisão e publicação.
- [x] Leitura assistida por IA de foto de etiqueta, com revisão antes de publicar.
- [x] Relatórios de produtos por setor, alterações de preço, ofertas vencidas e preços desatualizados.
- [x] Exportação CSV dos relatórios.
- [x] Remoção segura de produtos: ocultar quando já houver referências/preços, preservando histórico.

## Custos Supabase — otimizações no PR #1
- [x] Reduzir payload do catálogo com seleção explícita de colunas e cache de 2 minutos.
- [x] Comprimir fotos no navegador para JPEG de até 400 KB e limitar o bucket privado a 1 MiB.
- [x] Aplicar allowlist JPEG e manter caminhos de upload imutáveis sem ampliar a validade de cache de URLs assinadas.
- [x] Acrescentar testes unitários, pgTAP e regressão HTTP para MIME não permitido.
- [ ] Medir egress, bytes por imagem, chamadas REST, CPU e latência no projeto Supabase após implantação.

## Segurança — acompanhamento necessário
- [x] Adicionar arquivos .env ao .gitignore.
- [x] Remover o .env do estado atual da branch principal.
- [ ] Revogar/rotacionar qualquer segredo que tenha estado no .env publicado. A remoção do arquivo não apaga cópias do histórico Git.
- [ ] Avaliar com cuidado a limpeza do histórico Git caso tenha havido segredo privado. Não fazer force-push improvisado: este repositório é sincronizado com Lovable.
- [ ] Fazer revisão final das políticas RLS, funções SQL e permissões no ambiente Lovable Cloud; os testes pgTAP do branch passaram, mas o ambiente Lovable Cloud ainda precisa de validação.

## Validação antes do lançamento
- [x] CI no commit `10c8473`: ESLint (com a regra Prettier temporariamente desativada), testes unitários e build de produção aprovados no GitHub Actions. A execução local ainda não foi feita.
- [ ] Testar em Android real: câmera, leitura de EAN, captura/seleção de fotos e envio.
- [ ] Testar em duas contas/navegadores: atualização de preço compartilhada e isolamento de mercados.
- [ ] Testar visitante, cliente, parceiro e administrador com permissões diferentes.
- [ ] Testar importação CSV/Excel: arquivo válido, EAN inválido, EAN repetido, preço inválido, oferta vencida e correção de linha.
- [ ] Confirmar no banco de produção que histórico é gerado e que apenas produtos aprovados aparecem ao consumidor.
- [ ] Verificar custos, limites e política de pausa do Lovable Cloud antes de ampliar o uso.

## Estado verificado em 08/11/2026
- [x] Workflow manual de Storage inclui pré-validação dos oito secrets e da variável `SUPABASE_STORAGE_TEST_EXPECTED_HOST`, comparação exata do host, validação sintática do runner e bloqueio de execuções simultâneas no mesmo staging.
- [x] Documentação de staging inclui SQL de criação do mercado de teste e vínculo da conta parceira; não contém credenciais.
- [x] CI de qualidade no commit `10c8473`: lint (sem regra Prettier), testes unitários e build de produção aprovados.
- [x] CI SQL no commit `10c8473`: workflow Drizzle + pgTAP aprovado.
- [ ] Integração HTTP do Storage em staging: runner corrigido para usar JPEG real, exigir parceiro com papel `market` + associação ao mercado, exigir cliente sem privilégios/vínculos, validar hostname de staging e reprovar falha de limpeza. Continua aguardando projeto, contas de teste e configuração dos secrets/variável do ambiente GitHub `staging`.
- [ ] Validação do app publicado, testes em Android, teste funcional de perfis/mercados e verificação de custos Lovable Cloud ainda pendentes.

## Próxima prioridade
1. Preparar o ambiente Supabase `staging` e executar o teste real do Storage.
2. Confirmar e, se necessário, rotacionar segredos privados antigos; avaliar o histórico Git sem reescrever o histórico conectado ao Lovable.
3. Fazer testes manuais em Android e com contas de perfis/mercados diferentes.
4. Validar o app publicado e os custos/limites do Lovable Cloud.
5. Obter revisão independente antes de integrar as migrações em produção.