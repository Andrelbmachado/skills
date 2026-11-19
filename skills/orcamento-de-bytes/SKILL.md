---
name: orcamento-de-bytes
description: Use quando um programa, jogo ou payload precisa caber num limite rígido de tamanho (QR code, URL, concurso estilo js13k, firmware, campo de cabeçalho) e cada byte conta.
---

# Orçamento de bytes

## Passos
1. Descubra cedo o limite REAL no canal e no aparelho de destino, testando um payload fictício no aparelho.
2. Escreva um script que mede o tamanho final comprimido e codificado e rode a cada mudança.
3. Faça primeiro uma versão mínima funcionando, mesmo acima do limite, para ver a distância do objetivo.
4. Corte juntando sistemas parecidos antes de micro-otimizar.
5. Gere em código em vez de guardar: fontes como bitmaps numéricos, sprites simétricos guardados pela metade e espelhados, mapas procedurais por seed, cores derivadas de uma base.
6. Corte recursos caros e de pouco valor (som, recordes, opções), medindo quanto cada um custa.
7. Comprima (ex.: deflate-raw com descompressão nativa) e escolha a codificação do canal (base64url, Base45, alfabeto URL-safe próprio).
8. Se o payload carrega código executável (loader que faz eval do fragmento da URL), hospede o loader num domínio isolado, sem cookies nem sessão.
9. Valide a versão final no aparelho real antes de publicar.

## Limites
- Truques espertos rendem menos que fazer menos coisas diferentes.
- Sacrifique legibilidade só no artefato final; mantenha o fonte legível.

Fonte: @thesidcodes (tower defense de 2.749 bytes num QR code).
