---
name: upload-feedback-recovery
description: Use quando revisar ou projetar upload de arquivos e precisar de feedback no arraste, progresso verdadeiro, retomada e recuperação por arquivo.
---

# Upload com feedback e recuperação

## Fluxo
1. Fazer a área de envio reagir antes de soltar o arquivo, com borda e mensagem que confirmem onde o drop será aceito.
2. Durante o envio, mostrar progresso mensurável, porcentagem e tempo restante quando houver informação para calculá-los. Não trocar incerteza por um percentual fictício.
3. Em falha, manter o arquivo na própria linha e oferecer retry. Quando o transporte permitir retomada, preservar o que já foi enviado em vez de reiniciar do zero.
4. Mostrar prova do arquivo recebido: miniatura quando aplicável, tipo e tamanho. Não declarar recebimento antes de ele ser confirmado.
5. Em lotes, dar a cada arquivo seu próprio progresso e retry; a falha de um não deve esconder o estado dos outros.
6. Revisar o percurso completo: arrastar, enviar, falhar, tentar de novo e concluir. Registrar onde a implementação ainda não suporta o comportamento desejado.

## Limites
- A aparência de confiança não equivale a segurança. Validação de tipo/conteúdo, autorização e armazenamento pertencem à revisão de segurança.
- Não prometer retomada se o backend não a suporta; documentar a lacuna em vez de simular sucesso.
- Para semântica, foco e anúncios acessíveis de estado, consultar as skills de acessibilidade existentes.
