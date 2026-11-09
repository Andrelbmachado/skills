---
name: social-video-analysis
description: Use quando receber um link de vídeo de rede social para entender o conteúdo (Threads, Instagram, TikTok, YouTube Shorts, X). Baixa o vídeo, extrai frames e áudio, transcreve com whisper, e gera relatório padrão (ANALISE.md) com o que aparece, o que é dito, ritmo, gancho, CTA e motivo do engajamento.
---

# social-video-analysis

**Use quando receber um link de vídeo de rede social para entender o conteúdo.** Também serve como etapa de "vídeo de referência" antes de criar um reel/post parecido. Nunca publica nada em rede social.

## Passo a passo
1. Pasta de saída: `~/Documents/Trabalho/video-analysis/<rede>-<id>/` (ou a pasta do projeto).
2. Rode o script determinístico (download → frames → áudio → transcrição):
   ```bash
   python3 ~/.claude/skills/social-video-analysis/scripts/analyze_video.py "<URL ou arquivo.mp4>" -o <OUTDIR> [--fps 1] [--max-frames 40] [--whisper-model base] [--lang pt]
   ```
   - Download: `yt-dlp` primeiro; se falhar (ex.: Threads não é suportado), cai para **Playwright headless** que extrai o mp4 do HTML (cria venv em `~/.cache/social-video-analysis/venv` sozinho).
   - Saída: `video.mp4`, `frames/f_NNNN.jpg`, `contact_sheet.jpg`, `audio.wav`, `transcript.txt/.json`, `meta.json` (duração, resolução, legenda do post, volume do áudio).
   - Áudio mudo (< −50 dB) → whisper é pulado (evita alucinação tipo "You"); isso vira achado da análise.
   - Posts com carrossel/várias mídias: o script pega o 1º vídeo; rode de novo com a URL direta se preciso.
3. **Olhe** `contact_sheet.jpg` e, para detalhes/texto na tela, os frames individuais (Read de imagem). Leia `transcript.txt` e `meta.json`.
4. Escreva `<OUTDIR>/ANALISE.md` (modelo abaixo). Seja factual: só descreva o que viu/ouviu; marque hipóteses como hipóteses; liste limitações (palavras cortadas, sem métricas reais).

## Modelo do ANALISE.md
Cabeçalho (link, duração, resolução, áudio) → Legenda do post → Linha do tempo por frame (tabela t | visual) → Áudio/transcrição (fala, música, SFX, mudo) → Texto na tela → Formato e ritmo (cortes, zooms, duração por cena) → Gancho (0–3 s) → CTA → Por que engajou (hipóteses) → Aproveitável para os nossos posts → Limitações.

## Notas
- Dependências: `yt-dlp`, `ffmpeg`, `whisper` (openai-whisper CLI). Falta algo → `brew install yt-dlp ffmpeg`, `pip install openai-whisper`.
- Português: use `--lang pt` e `--whisper-model small` para melhor qualidade.
- Login-walled (Instagram privado etc.): yt-dlp `--cookies-from-browser chrome`; sem acesso, diga que não foi possível e peça o arquivo.
- Registre tokens/tempo em `~/metrics/metrics.csv` (`~/skills-repo/scripts/log-metrics.sh`).
