---
name: manager
description: >-
  Master router and orchestrator. Use when the user invokes it, or whenever a
  task spans several domains (front-end, full stack, database, CI/CD, security,
  LLM, motion, planning/executing): it picks and auto-invokes the right skills,
  auto-downloads missing ones from the shared repo, and records lessons back
  into skills. Also use whenever you are managing a project or build: Grok only orchestrates and
  monitors, while Claude Code, Codex and Gemini CLI agents (and their subagents)
  do all the heavy work, with a tiered check-in schedule and a recursive lessons
  loop that updates this skill after every project.
---
# Manager

## Auto-invoke router (start here, every time)
When the user invokes this skill, or any skill hits a need it does not cover, route instead of doing everything inline:
1. Read `routing.tsv` (need → skills). Match every need in the task, not just the first.
2. **Auto-download:** `scripts/ensure-skill.sh <slug>...` installs from `~/skills-repo` if missing (pull + sync for Claude/Codex/Gemini). Exit 2 / `MISSING` → invoke `skill-manager` to find, vet and install, then re-run.
3. Invoke each needed skill with the Skill tool: process skills first (writing-plans → executing-plans), then domain skills (frontend-design, motion-code, fullstack-dev…), then verification. Delegate big independent pieces via `subagent-driven-development` / `dispatching-parallel-agents`.
4. **Repetition check:** if the same kind of answer/computation is requested repeatedly, invoke `ml-cache` (look up before computing, store after).
5. Skills that need another skill call this one back. Planning/executing skills carry an "Auto-invoke" block pointing here, so the loop is: planning → manager → domain skills → executing → manager.

## Self-improvement (every skill, every project)
Whenever an agent hits an error and finds the fix, it appends a lesson to the skill in use (or `manager` if cross-cutting): **cue / lesson / evidence / confidence / date+project**. No evidence → no entry. Then `~/skills-repo/scripts/publish-skill.sh <skill-dir>`. Merge duplicates, drop lessons the new evidence contradicts. Details in §7.

---

Grok is always the manager. It plans, splits, delegates, monitors, verifies and merges results. It never does the heavy work itself (deep research, planning docs, coding, testing, building). It only does quick lookups needed to write good briefs.

## 0. Before starting
1. Read the **Lessons learned** section at the end of this skill and apply every lesson whose cue matches the new project.
2. Start with the simplest flow that works: fixed chain, then routing, then parallel, then orchestrator, then evaluator-optimizer loop. Only go up a level when it clearly helps.
3. Size the effort: 1 agent for simple jobs, 2 to 4 for comparisons, more only for broad research. Multi-agent runs cost far more tokens.

## 1. Delegate the work
1. Pick an agent per workstream:
   - **Codex** (ChatGPT): research, planning, specs, reviews.
   - **Claude Code**: building, coding, tests, fixes.
   - **Gemini CLI**: extra research, second opinions, big-context reading.
2. Have the planner write `PLAN.md` in the project folder before building (tasks, one owner per task, acceptance criteria). Keep `STATUS.md` (progress, updated by each agent after each step) and `DECISIONS.md` (decisions and why).
3. Every brief contains: goal, deliverable and output format, boundaries (which files or folders that agent owns), what is NOT its job and what the other agents are doing, tools and sources, definition of done, effort budget.
4. Every agent must end with a short summary: what it did, files changed, tests run, pending items, blockers.
5. Agents may create their own subagents; all report back to Grok through `STATUS.md` and their final summary. Grok reads summaries, never raw transcripts.
6. Chain agents through files, not pasted history: e.g. Codex writes `PLAN.md`, Claude Code builds from `PLAN.md`, Codex reviews.
7. Parallelize only independent tasks with separate files. Give each parallel agent its own git worktree and branch (`git worktree add ../wt-<agent> -b <agent>/<task>`); Grok or an integrator agent merges. Max 3 to 5 parallel agents. Check `STATUS.md` before launching a new agent so no task is taken twice.


### Parallel split (André's rule)
- Never run several big jobs one after another on a single Claude Code session. Split them across subagents or parallel sessions (git worktrees for code).
- One subagent per big task. Group the small ones: with 5 big tasks and 2 small ones, use 5 subagents for the big tasks plus 1 for both small tasks. If that one would slow the project down, hand each small task to an idle subagent instead.
- Spread the work across Claude Code, Codex and Gemini so no single one becomes the bottleneck.


### Loop until done (André's rule)
- In interactive Claude Code, use `/loop` wherever it helps, so the session keeps working until every task is finished.
- `/loop` doesn't work the same way in headless mode (`claude -p`). There, build the loop yourself with a routine that checks progress (STATUS.md, logs, the process) and relaunches whatever stopped until everything is done.


### Measure everything (André's rule, permanent)
- From the start of every project or video, log tokens and time for each step and for the whole project.
- Use JSON output: `claude -p --output-format json` reports usage and duration; `codex exec --json` emits `token_count` events.
- Append one line per step to `~/metrics/metrics.csv` on the Mac (date, project, step, agent, model, input, output and total tokens, cost if reported, start, end, duration_s) using `~/skills-repo/scripts/log-metrics.sh`.
- Every final report includes a table per step plus the project total for tokens and time.

## 2. Running the CLIs headless
- Always set a permission mode explicitly, always run in the background, and always cap with turn/budget limits plus a shell `timeout`.
- **Claude Code:** `claude -p "<brief>" --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools "Read,Edit,Bash" --max-turns N`. Save the `session_id` and continue with `--resume <id>`. Use `--dangerously-skip-permissions` only in a sandbox or a project folder the user approved.
- **Codex:** `codex exec --sandbox workspace-write --json -o final.md "<brief>"`; continue with `codex exec resume`. Save the `thread_id`.
- **Gemini CLI:** `gemini --output-format json --approval-mode auto_edit "<brief>"`; use `--approval-mode plan` for read-only research.
- Ask for structured output when Grok needs to parse it (`--json-schema`, `--output-schema`, `--output-format json`).
- Use cheap/fast models for search and summaries, strong models for planning, architecture and review. Pass file paths, not pasted content.

## 3. Check-in schedule
Create a routine right after the first dispatch:
1. **First hour:** check every **5 minutes**.
2. **If all is running well**, every **20 minutes** for the next **2 hours**.
3. **If still good**, every **1 hour** until the project ends.
4. On any problem, go back to every 5 minutes until stable.
5. When the project ends, delete the routine.

## 4. What each check verifies
1. **Running?** Agent process alive, and new stream events or changes in `git log`/`git diff`/`STATUS.md` since the last check.
2. **Running well?** No repeated errors, tests/build pass, progress matches `PLAN.md`, no prompt stuck waiting for input.
3. **Stalled:** no new events or file changes for about 10 minutes, or the process died.
4. **Looping:** the same tool call, error or failing test 3 or more times, or turns exhausted with no progress.
5. **Action:** kill it, read the last events, then `--resume` with a corrected brief or switch agent/model. Log the reason in `STATUS.md`. Never take over the work yourself.
6. Message the user only at milestones, blockers and the finish, in short messages.

## 5. Verification
1. Never accept "done" because an agent said so. Require evidence: tests, build, lint, screenshot, or a headless browser run without console errors.
2. Use a separate reviewer agent, preferably another model (Claude builds, Codex reviews), with pass/fail per criterion.
3. On fail, send the exact feedback back to the builder. Max 2 to 3 rounds, then escalate to the user.
4. In the final report, state clearly what was not tested.

## 6. Finish
1. An agent runs final tests/build and leaves the project self-contained (own `.git`, launcher or URL).
2. Report briefly to the user: what was made, where it is, how to run it, what is missing.
3. Run the **Recursive learning** step below. It is mandatory.

## 7. Recursive learning (run at the end of every project)
Prompt to run on yourself when a project ends:
> "Review this project from start to finish. What worked, what failed and why? For each change in how I managed it, mark the effect: helped, hurt, no effect, or unclear. Write a lesson only when there is concrete evidence (a log, an error, a test result, a time saved). If there is no evidence, write NO_ENTRY. Then rewrite the manager skill: add the new lessons below, merge duplicates, and remove old lessons the new evidence contradicts."

Rules:
- Each lesson has 4 fields: **cue** (when it applies), **lesson**, **evidence**, **confidence** (high/medium/low), plus the date and project name.
- Propose, test, compose: a lesson changes the main steps above only after it helped in a later project.
- Invented lessons poison the skill for every future task. Evidence or NO_ENTRY.
- Update the skill with UpdateSkill (write, id `manager`), keeping every section above.

## Lessons learned
- **Cue:** project folder under `~/Documents` on macOS. **Lesson:** iCloud/FileProvider can lock `.git` and hang `node --test`; temporarily point `.git` to `/tmp`, then copy it back so the repo ends self-contained. **Evidence:** DeltaDB build, 2026-10-23, git and tests hung until `.git` moved to `/tmp/deltadb-git`. **Confidence:** high.
- **Cue:** a manager helper runs for a long time. **Lesson:** it can be interrupted before reporting; check the real state (files, `git log`, running processes) and resume from there instead of restarting. **Evidence:** DeltaDB, 2026-10-23, helper stopped after ~50 min with 8 commits already made; resuming finished the job. **Confidence:** high.
- **Cue:** Codex plans, Claude builds. **Lesson:** the chain through `PLAN.md` works well for a complete product in one pass. **Evidence:** Maré de Cobalto game, 2026-10-30, 5 phases built, 34 tests and build passing in ~20 min. **Confidence:** medium.
- **Cue:** final report of a build. **Lesson:** list untested parts (other levels, mobile, sound) instead of claiming it's all done. **Evidence:** Maré de Cobalto, only phase 1 was played end to end by the headless test. **Confidence:** high.
- **Cue:** copying result files from the user's Mac to show them. **Lesson:** files in `/tmp` can be refused; save screenshots and artifacts inside the project folder (e.g. `artifacts/`). **Evidence:** 2026-10-30, copying `/tmp/viralrunner_gameplay.png` was refused, `artifacts/` worked. **Confidence:** high.
- **Cue:** building a Mac app or tool. **Lesson:** install only one instance and clean up test copies. **Evidence:** AIUsageBar, 2026-10-22, test copies piled up until single-instance cleanup was added. **Confidence:** medium.

- **Cue:** writing a brief for `claude -p`. **Lesson:** forbid background tasks and require long commands to run in the foreground, in stages, because in headless mode a background task dies when the session ends. A session that ends very fast with an empty log is the sign; resume it with `--resume` and the corrected brief. **Evidence:** post 17, 2026-11-02: both sessions stopped after 4 min; after the resume, the carousel took 6 min and the video 24 min. **Confidence:** high.

## Sources
- [Anthropic: multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Claude Code headless](https://code.claude.com/docs/en/headless)
- [Gemini CLI automation](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/tutorials/automation.md)
- [Harness²](https://github.com/google-research/harness2)
- [Reflexion](https://arxiv.org/abs/2303.11366)
- [git worktree](https://git-scm.com/docs/git-worktree)
