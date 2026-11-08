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

## Segurança — acompanhamento necessário
- [x] Adicionar arquivos .env ao .gitignore.
- [x] Remover o .env do estado atual da branch principal.
- [ ] Revogar/rotacionar qualquer segredo que tenha estado no .env publicado. A remoção do arquivo não apaga cópias do histórico Git.
- [ ] Avaliar com cuidado a limpeza do histórico Git caso tenha havido segredo privado. Não fazer force-push improvisado: este repositório é sincronizado com Lovable.
- [ ] Fazer revisão final das políticas RLS, funções SQL e permissões no ambiente Lovable Cloud.

## Validação antes do lançamento
- [ ] Rodar localmente bun run lint, bun run test e bun run build.
- [ ] Testar em Android real: câmera, leitura de EAN, captura/seleção de fotos e envio.
- [ ] Testar em duas contas/navegadores: atualização de preço compartilhada e isolamento de mercados.
- [ ] Testar visitante, cliente, parceiro e administrador com permissões diferentes.
- [ ] Testar importação CSV/Excel: arquivo válido, EAN inválido, EAN repetido, preço inválido, oferta vencida e correção de linha.
- [ ] Confirmar no banco de produção que histórico é gerado e que apenas produtos aprovados aparecem ao consumidor.
- [ ] Verificar custos, limites e política de pausa do Lovable Cloud antes de ampliar o uso.

## Próxima prioridade
1. Rotacionar segredos expostos e concluir a revisão de segurança.
2. Rodar os testes automatizados e corrigir eventuais falhas.
3. Fazer a rodada de testes manuais em Android e com contas de perfis diferentes.
4. Atualizar a documentação com os resultados reais desses testes.