---
name: web-launch-readiness
description: Use quando preparar o lançamento de um site ou app web e precisar conferir metadados sociais, separação app/marketing, reputação de e-mail e indexação.
---

# Preparação de lançamento web e domínio

## Fluxo
1. Separar a página de marketing da aplicação, quando ambas existirem: domínio principal para marketing e subdomínio para o app. Registrar a estrutura proposta antes de alterar DNS; não criar um app artificialmente em um site apenas institucional.
2. Preparar os metadados Open Graph com título, descrição e imagem de compartilhamento. No projeto existente, conferir os valores realmente usados, não só a presença de um objeto de configuração.
3. Se houver e-mail transacional e marketing, planejar subdomínios separados para esses dois usos. Conferir SPF, DKIM e DMARC conforme o serviço adotado; não inventar valores de registros DNS.
4. Preparar o sitemap.xml e a indexação pelo Google Search Console. Diferenciar arquivo preparado de submissão efetivamente feita.
5. Para apps, conferir o checklist de onboarding. Se houver necessidade de analisar o funil, considerar product analytics; o exemplo ensinado usa PostHog com cookie banner. Não adicionar rastreamento sem necessidade.
6. Entregar uma lista de verificação com cada item como conferido, pendente ou não aplicável. Indicar qual decisão ou acesso ainda falta.

## Limites
- Complementa, não substitui, revisão de acessibilidade, segurança e CI/CD.
- Preparar é diferente de publicar: mudanças em DNS/produção, configuração externa, submissão de sitemap e envio de e-mail dependem das permissões aplicáveis.
- Não afirmar que o domínio está autenticado ou indexado sem evidência real.
