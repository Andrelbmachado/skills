---
name: blue-green-release-plan
description: Use quando planejar uma troca blue-green com testes no ambiente inativo, reversão de tráfego e compatibilidade do banco compartilhado.
---

# Plano de release blue-green

## Fluxo
1. Identificar o ambiente que recebe tráfego (Blue) e o ambiente inativo (Green). Registrar qual versão está em cada um.
2. Planejar a implantação da nova versão no ambiente inativo, sem trocar o tráfego durante essa etapa.
3. Testar a versão no ambiente inativo antes da troca. Usar o pipeline de verificação já existente, em vez de assumir que implantar equivale a validar.
4. Se os ambientes compartilham banco, conferir compatibilidade do schema com as duas versões. Planejar alterações pelo padrão expand/contract; incompatibilidade impede chamar a reversão de tráfego de rollback seguro.
5. Preparar a troca do balanceador para o ambiente validado e o caminho inverso para retornar ao ambiente anterior em caso de falha.
6. Entregar o plano com estado inicial, verificações, troca proposta e reversão. Distinguir o que foi apenas planejado do que foi executado.

## Limites
- Esta receita não autoriza mudar tráfego nem banco de produção.
- Reverter tráfego não desfaz automaticamente migrações ou efeitos sobre dados.
- Não inventar comandos de provedor, endpoints de saúde ou configuração de balanceador ausentes no projeto.
