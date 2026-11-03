---
name: skills-synchronizer
description: Keeps every AI agent (Grok, Claude Code, Codex, Gemini CLI) in sync with the shared skills repo github.com/Andrelbmachado/skills. Use whenever you install, create or edit a skill, and once per day to pull and import missing skills.
---

# Skills Synchronizer

Shared repo: `~/skills-repo` (remote `github.com/Andrelbmachado/skills`). Layout: `skills/<slug>/SKILL.md` (uppercase).

## Rules

1. **Publish on install/create/edit.** Whenever any AI (Grok, Claude Code, Codex, Gemini CLI) installs or creates a new skill, or edits one, immediately run:
   `~/skills-repo/scripts/publish-skill.sh <skill-dir-or-SKILL.md>`
   It copies the skill to `skills/<slug>/` (SKILL.md uppercase, valid frontmatter with `name` = slug and `description`), commits, pulls --rebase, pushes, then runs `sync.sh`.
2. **Daily check.** Every AI checks the repo once per day: `git -C ~/skills-repo pull && ~/skills-repo/sync.sh`, importing any missing skills:
   - Claude Code (`~/.claude/skills`) and Gemini CLI (`~/.gemini/skills`): symlinks.
   - Codex (`~/.codex/skills`): real copies, never symlinks.
   - Grok: copy into `/home/box/agent-data/workflows/<slug>/SKILL.md`.
3. **Safety.** Never push secrets (.env, keys, tokens, credentials). On push conflict: `git pull --rebase` then push again.

## Automation (macOS)

launchd job `com.dziny.skills-sync` runs daily at 09:00 and at load:
`/bin/bash -lc 'cd ~/skills-repo && git pull -q && ./sync.sh'`
- Plist: `~/Library/LaunchAgents/com.dziny.skills-sync.plist` (copy in `scripts/com.dziny.skills-sync.plist`)
- Log: `~/Library/Logs/skills-sync.log`
- Reload: `launchctl bootout gui/$(id -u)/com.dziny.skills-sync; launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.dziny.skills-sync.plist`
