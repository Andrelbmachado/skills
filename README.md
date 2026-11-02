# Skills de André Machado

Todas as skills (Grok, Claude Code, Codex, Gemini). Para importar: `./sync.sh`. Veja AGENTS.md.

| Skill | Origem | Descrição |
|---|---|---|
| [airunway-aks-setup](skills/airunway-aks-setup) | codex | Set up AI Runway on AKS — from bare cluster to running model. Covers cluster verification, controller install, GPU assessment, provider setup, and first deployment. WHEN: \"setup AI Runway\", \"onboar |
| [android-design-guidelines](skills/android-design-guidelines) | claude, codex | Material Design 3 and Android platform guidelines. Use when building Android apps with Jetpack Compose or XML layouts, implementing Material You, navigation, or accessibility. Triggers on tasks involv |
| [appinsights-instrumentation](skills/appinsights-instrumentation) | codex | Guidance for instrumenting webapps with Azure Application Insights. Provides telemetry patterns, SDK setup, and configuration references. WHEN: how to instrument app, App Insights SDK, telemetry patte |
| [apple-ai-chat-design](skills/apple-ai-chat-design) | claude | Design system para apps de mensagem com IA no estilo Apple/ChatGPT. Use esta skill quando estiver desenvolvendo apps de IA conversacional em SwiftUI, React ou web — garantindo padrões rígidos de cores |
| [azure-ai](skills/azure-ai) | codex | Use for Azure AI: Search, Speech, OpenAI, Document Intelligence. Helps with search, vector/hybrid search, speech-to-text, text-to-speech, transcription, OCR. WHEN: AI Search, query search, vector sear |
| [azure-aigateway](skills/azure-aigateway) | codex | Configure Azure API Management as an AI Gateway for AI models, MCP tools, and agents. WHEN: semantic caching, token limit, content safety, load balancing, AI model governance, MCP rate limiting, jailb |
| [azure-app-onboard](skills/azure-app-onboard) | codex | End-to-end orchestrator: from a business idea, app idea, or existing app to running Azure deployment with cost estimates and pre-deploy approval. Analyzes your app, auto-detects the right Azure servic |
| [azure-app-onboard-prereq](skills/azure-app-onboard-prereq) | codex | Assess whether source code is ready to deploy to Azure — the check BEFORE infrastructure work. Evaluates build health, app completeness, dependencies and local services, stack compatibility, and deplo |
| [azure-cloud-migrate](skills/azure-cloud-migrate) | codex | Assess and migrate cross-cloud workloads to Azure with reports and code conversion. Supports Lambda→Functions, Beanstalk/Heroku/App Engine→App Service, Fargate/Kubernetes/Cloud Run/Spring Boot→Contain |
| [azure-compliance](skills/azure-compliance) | codex | Run Azure compliance and security audits with azqr plus Key Vault expiration checks. Covers best-practice assessment, resource review, policy/compliance validation, and security posture checks. WHEN:  |
| [azure-compute](skills/azure-compute) | codex | Azure VM/VMSS router. WHEN: create / provision / deploy / spin-up VM, recommend VM size, compare VM pricing, VMSS, scale set, autoscale, burstable, lightweight server, website, backend, GPU, machine l |
| [azure-cost](skills/azure-cost) | codex | Azure cost management: query costs, forecast spending, optimize to reduce waste. WHEN: \"Azure costs\", \"Azure bill\", \"cost breakdown\", \"how much am I spending\", \"forecast spending\", \"optimiz |
| [azure-deploy](skills/azure-deploy) | codex | Execute Azure deployments for ALREADY-PREPARED applications that have existing .azure/deployment-plan.md and infrastructure files. DO NOT use this skill when the user asks to CREATE a new application  |
| [azure-diagnostics](skills/azure-diagnostics) | codex | Debug Azure production issues on Azure using AppLens, Azure Monitor, resource health, and safe triage. WHEN: debug production issues, troubleshoot app service, app service high CPU, app service deploy |
| [azure-enterprise-infra-planner](skills/azure-enterprise-infra-planner) | codex | Architect and provision enterprise Azure infrastructure from workload descriptions. For cloud architects and platform engineers planning networking, identity, security, compliance, and multi-resource  |
| [azure-kubernetes](skills/azure-kubernetes) | codex | Plan, create, and configure production-ready Azure Kubernetes Service (AKS) clusters. Covers Day-0 checklist, SKU selection (Automatic vs Standard), networking options (private API server, Azure CNI O |
| [azure-kubernetes-automatic-readiness](skills/azure-kubernetes-automatic-readiness) | codex | Assess Kubernetes workloads and cluster configuration for AKS Automatic compatibility. Identifies incompatibilities, generates fixes, and guides migration from AKS Standard to AKS Automatic. WHEN: mig |
| [azure-kusto](skills/azure-kusto) | codex | Query and analyze data in Azure Data Explorer (Kusto/ADX) using KQL for log analytics, telemetry, and time series analysis. WHEN: KQL queries, Kusto database queries, Azure Data Explorer, ADX clusters |
| [azure-messaging](skills/azure-messaging) | codex | Troubleshoot and resolve issues with Azure Messaging SDKs for Event Hubs and Service Bus. Covers connection failures, authentication errors, message processing issues, and SDK configuration problems.  |
| [azure-prepare](skills/azure-prepare) | codex | Prepare azd-based Azure projects for deployment: generates azure.yaml, infrastructure (Bicep/Terraform), and Dockerfiles for the Azure Developer CLI (azd) workflow. USE ONLY when the user explicitly w |
| [azure-quotas](skills/azure-quotas) | codex | Check/manage Azure quotas and usage across providers. For deployment planning, capacity validation, region selection. WHEN: \"check quotas\", \"service limits\", \"current usage\", \"request quota inc |
| [azure-reliability](skills/azure-reliability) | codex | Assess and improve the reliability posture of PaaS Applications (Azure Functions and Azure App Service). Scans deployed resources for zone redundancy, ZRS storage, health probes, and multi-region fail |
| [azure-resource-lookup](skills/azure-resource-lookup) | codex | List, find, and show Azure resources across subscriptions or resource groups. Handles prompts like \"list the websites in my subscription\", \"list my web apps\", \"show my app services\", \"list virt |
| [azure-resource-visualizer](skills/azure-resource-visualizer) | codex | Analyze Azure resource groups and generate detailed Mermaid architecture diagrams showing the relationships between individual resources. WHEN: create architecture diagram, visualize Azure resources,  |
| [azure-storage](skills/azure-storage) | codex | Azure Storage Services including Blob Storage, File Shares, Queue Storage, Table Storage, and Data Lake. Answers questions about storage access tiers (hot, cool, cold, archive), when to use each tier, |
| [azure-upgrade](skills/azure-upgrade) | codex | Assess and upgrade Azure workloads between plans, tiers, or SKUs, or modernize Azure SDK dependencies in source code. WHEN: upgrade Consumption to Flex Consumption, upgrade Azure Functions plan, chang |
| [azure-validate](skills/azure-validate) | codex | Pre-deployment validation for Azure readiness. Run deep checks on configuration, infrastructure (Bicep or Terraform), RBAC role assignments, managed identity permissions, and prerequisites before depl |
| [built-in-browser](skills/built-in-browser) | claude | Read this skill before the first step that uses the built-in browser, the browser pane inside the Claude desktop app (also called the in-app browser, the browser pane, Claude's browser, or \"your own  |
| [capacity](skills/capacity) | codex | Discovers available Azure OpenAI model capacity across regions and projects. Analyzes quota limits, compares availability, and recommends optimal deployment locations based on capacity requirements. U |
| [cavecrew](skills/cavecrew) | claude | > |
| [caveman](skills/caveman) | claude | > |
| [caveman-commit](skills/caveman-commit) | claude | > |
| [caveman-compress](skills/caveman-compress) | claude | > |
| [caveman-help](skills/caveman-help) | claude | > |
| [caveman-review](skills/caveman-review) | claude | > |
| [caveman-stats](skills/caveman-stats) | claude | > |
| [chrome-browser](skills/chrome-browser) | claude | Read this skill before the first step that uses Claude in Chrome, the browser extension whose tools are named mcp__claude-in-chrome__* (also called Chrome, the browser extension, or the external brows |
| [computer-use](skills/computer-use) | claude | Read this skill before the first step of any request to do something in an app on the person's own computer (Notes, Finder, System Settings, any desktop app), to look at their screen, or for \"compute |
| [criar-site-arte](skills/criar-site-arte) | claude | Cria sites, dashboards e app screens temáticos de movimentos artísticos/civilizações (style kits do Design Master — Paleolítico, Egito, Mesopotâmia, Grécia, Barroco, Art Nouveau, Bauhaus, etc.). Orque |
| [customize](skills/customize) | codex | Interactive guided deployment flow for Azure OpenAI models with full customization control. Step-by-step selection of model version, SKU (GlobalStandard/Standard/ProvisionedManaged), capacity, RAI pol |
| [debug-issue](skills/debug-issue) | claude | Systematically debug issues using graph-powered code navigation |
| [deep-research](skills/deep-research) | claude | Use this skill when the user's prompt requires (1) researching a topic across multiple sources, comparing options or alternatives, analyzing trends or history, understanding markets or industries, or  |
| [deltadb-omniscient](skills/deltadb-omniscient) | claude | Use when resuming work, needing context from previous agent sessions (Claude, Codex, Gemini, Grok), asking "why was this code written", or handing work off to another AI. Queries the local DeltaDB sto |
| [deploy](skills/deploy) | codex |  |
| [deploy-model](skills/deploy-model) | codex | Unified Azure OpenAI model deployment skill with intelligent intent-based routing. Handles quick preset deployments, fully customized deployments (version/SKU/capacity/RAI policy), and capacity discov |
| [develop-web-game](skills/develop-web-game) | codex | Use when Codex is building or iterating on a web game (HTML/JS) and needs a reliable development + testing loop: implement small changes, run a Playwright-based test script with short input bursts and |
| [docs](skills/docs) | claude | docs (editable docs people share and comment on; the default for any document, named as a doc or not: a document, report, proposal, resume, cover letter, letter, contract, policy, form, template, work |
| [docx](skills/docx) | claude | Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx) or Word templates (.dotx). Triggers include: any mention of Microsoft Word Documents, such as 'Word d |
| [entra-agent-id](skills/entra-agent-id) | codex | Provision Microsoft Entra Agent Identity Blueprints, BlueprintPrincipals, and per-instance Agent Identities via Microsoft Graph, and configure OAuth 2.0 token exchange (fmi_path, OBO, cross-tenant) in |
| [entra-app-registration](skills/entra-app-registration) | codex | Guides Microsoft Entra ID app registration, OAuth 2.0 authentication, and MSAL integration. USE FOR: create app registration, register Azure AD app, configure OAuth, set up authentication, add API per |
| [everything-claude-code-conventions](skills/everything-claude-code-conventions) | claude | Development conventions and patterns for everything-claude-code. JavaScript project with conventional commits. |
| [explore-codebase](skills/explore-codebase) | claude | Navigate and understand codebase structure using the knowledge graph |
| [figma](skills/figma) | codex | Use the Figma MCP server to fetch design context, screenshots, variables, and assets from Figma, and to translate Figma nodes into production code. Trigger when a task involves Figma URLs, node IDs, d |
| [figma-code-connect-components](skills/figma-code-connect-components) | codex | Connects Figma design components to code components using Code Connect mapping tools. Use when user says "code connect", "connect this component to code", "map this component", "link component to code |
| [figma-create-design-system-rules](skills/figma-create-design-system-rules) | codex | Generates custom design system rules for the user's codebase. Use when user says "create design system rules", "generate rules for my project", "set up design rules", "customize design system guidelin |
| [figma-create-new-file](skills/figma-create-new-file) | codex | Create a new blank Figma file. Use when the user wants to create a new Figma design or FigJam file, or when you need a new file before calling use_figma. Handles plan resolution via whoami if needed.  |
| [figma-generate-design](skills/figma-generate-design) | codex | Use this skill alongside figma-use when the task involves translating an application page, view, or multi-section layout into Figma. Triggers: 'write to Figma', 'create in Figma from code', 'push page |
| [figma-generate-library](skills/figma-generate-library) | codex | Build or update a professional-grade design system in Figma from a codebase. Use when the user wants to create variables/tokens, build component libraries, set up theming (light/dark modes), document  |
| [figma-implement-design](skills/figma-implement-design) | codex | Translates Figma designs into production-ready application code with 1:1 visual fidelity. Use when implementing UI code from Figma files, when user mentions "implement design", "generate code", "imple |
| [figma-use](skills/figma-use) | codex | **MANDATORY prerequisite** — you MUST invoke this skill BEFORE every `use_figma` tool call. NEVER call `use_figma` directly without loading this skill first. Skipping it causes common, hard-to-debug f |
| [find-skills](skills/find-skills) | claude, codex | Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This sk |
| [finetuning](skills/finetuning) | codex | Fine-tune models on Microsoft Foundry using SFT (supervised), DPO (preference), or RFT (reinforcement with graders). Covers dataset preparation, training job submission, deployment, and evaluation. US |
| [frontend-skill](skills/frontend-skill) | codex | Use when the task asks for a visually strong landing page, website, app, prototype, demo, or game UI. This skill enforces restrained composition, image-led hierarchy, cohesive content structure, and t |
| [gh-address-comments](skills/gh-address-comments) | codex | Help address review/issue comments on the open GitHub PR for the current branch using gh CLI; verify gh auth first and prompt the user to authenticate if not logged in. |
| [gh-fix-ci](skills/gh-fix-ci) | codex | Use when a user asks to debug or fix failing GitHub PR checks that run in GitHub Actions; use `gh` to inspect checks and logs, summarize failure context, draft a fix plan, and implement only after exp |
| [google-workspace](skills/google-workspace) | claude | Read this before the first Google Drive, Docs, Sheets or Slides connector call whenever the task creates or changes a Google file. Use this skill whenever the user wants to create or change a Google D |
| [gsd-add-tests](skills/gsd-add-tests) | claude | Generate tests for a completed phase based on UAT criteria and implementation |
| [gsd-ai-integration-phase](skills/gsd-ai-integration-phase) | claude | Generate an AI-SPEC.md design contract for phases that involve building AI systems. |
| [gsd-audit-fix](skills/gsd-audit-fix) | claude | Autonomous audit-to-fix pipeline — find issues, classify, fix, test, commit |
| [gsd-audit-milestone](skills/gsd-audit-milestone) | claude | Audit milestone completion against original intent before archiving |
| [gsd-audit-uat](skills/gsd-audit-uat) | claude | Cross-phase audit of all outstanding UAT and verification items |
| [gsd-autonomous](skills/gsd-autonomous) | claude | Run all remaining phases autonomously — discuss→plan→execute per phase |
| [gsd-capture](skills/gsd-capture) | claude | Capture ideas, tasks, notes, and seeds to their destination |
| [gsd-cleanup](skills/gsd-cleanup) | claude | Archive accumulated phase directories from completed milestones |
| [gsd-code-review](skills/gsd-code-review) | claude | Review source files changed during a phase for bugs, security issues, and code quality problems |
| [gsd-complete-milestone](skills/gsd-complete-milestone) | claude | Archive completed milestone and prepare for next version |
| [gsd-config](skills/gsd-config) | claude | Configure GSD settings — workflow toggles, advanced knobs, integrations, and model profile |
| [gsd-debug](skills/gsd-debug) | claude | Systematic debugging with persistent state across context resets |
| [gsd-discuss-phase](skills/gsd-discuss-phase) | claude | Gather phase context through adaptive questioning before planning. |
| [gsd-docs-update](skills/gsd-docs-update) | claude | Generate or update project documentation verified against the codebase |
| [gsd-eval-review](skills/gsd-eval-review) | claude | Audit an executed AI phase's evaluation coverage and produce an EVAL-REVIEW.md remediation plan. |
| [gsd-execute-phase](skills/gsd-execute-phase) | claude | Execute all plans in a phase with wave-based parallelization |
| [gsd-explore](skills/gsd-explore) | claude | Socratic ideation and idea routing — think through ideas before committing to plans |
| [gsd-extract-learnings](skills/gsd-extract-learnings) | claude | Extract decisions, lessons, patterns, and surprises from completed phase artifacts |
| [gsd-fast](skills/gsd-fast) | claude | Execute a trivial task inline — no subagents, no planning overhead |
| [gsd-forensics](skills/gsd-forensics) | claude | Post-mortem investigation for failed GSD workflows — diagnoses what went wrong. |
| [gsd-graphify](skills/gsd-graphify) | claude | Build, query, and inspect the project knowledge graph in .planning/graphs/ |
| [gsd-health](skills/gsd-health) | claude | Diagnose planning directory health and optionally repair issues |
| [gsd-help](skills/gsd-help) | claude | Show available GSD commands and usage guide |
| [gsd-import](skills/gsd-import) | claude | Ingest external plans with conflict detection against project decisions before writing anything. |
| [gsd-inbox](skills/gsd-inbox) | claude | Triage and review open GitHub issues and PRs against project templates and contribution guidelines. |
| [gsd-ingest-docs](skills/gsd-ingest-docs) | claude | Bootstrap or merge a .planning/ setup from existing ADRs, PRDs, SPECs, and docs in a repo. |
| [gsd-manager](skills/gsd-manager) | claude | Interactive command center for managing multiple phases from one terminal |
| [gsd-map-codebase](skills/gsd-map-codebase) | claude | Analyze codebase with parallel mapper agents to produce .planning/codebase/ documents |
| [gsd-milestone-summary](skills/gsd-milestone-summary) | claude | Generate a comprehensive project summary from milestone artifacts for team onboarding and review |
| [gsd-mvp-phase](skills/gsd-mvp-phase) | claude | Plan a phase as a vertical MVP slice — user story, SPIDR splitting, then plan-phase |
| [gsd-new-milestone](skills/gsd-new-milestone) | claude | Start a new milestone cycle — update PROJECT.md and route to requirements |
| [gsd-new-project](skills/gsd-new-project) | claude | Initialize a new project with deep context gathering and PROJECT.md |
| [gsd-ns-context](skills/gsd-ns-context) | claude | codebase intelligence / map graphify docs learnings |
| [gsd-ns-ideate](skills/gsd-ns-ideate) | claude | exploration capture / explore sketch spike spec capture |
| [gsd-ns-manage](skills/gsd-ns-manage) | claude | config workspace / workstreams thread update ship inbox |
| [gsd-ns-project](skills/gsd-ns-project) | claude | project lifecycle / milestones audits summary |
| [gsd-ns-review](skills/gsd-ns-review) | claude | quality gates / code review debug audit security eval ui |
| [gsd-ns-workflow](skills/gsd-ns-workflow) | claude | workflow / discuss plan execute verify phase progress |
| [gsd-pause-work](skills/gsd-pause-work) | claude | Create context handoff when pausing work mid-phase |
| [gsd-phase](skills/gsd-phase) | claude | CRUD for phases in ROADMAP.md — add, insert, remove, or edit phases |
| [gsd-plan-phase](skills/gsd-plan-phase) | claude | Create detailed phase plan (PLAN.md) with verification loop |
| [gsd-plan-review-convergence](skills/gsd-plan-review-convergence) | claude | Cross-AI plan convergence loop — replan with review feedback until no HIGH concerns remain. |
| [gsd-pr-branch](skills/gsd-pr-branch) | claude | Create a clean PR branch by filtering out .planning/ commits — ready for code review |
| [gsd-profile-user](skills/gsd-profile-user) | claude | Generate developer behavioral profile and create Claude-discoverable artifacts |
| [gsd-progress](skills/gsd-progress) | claude | Check progress, advance workflow, or dispatch freeform intent — the unified GSD situational command |
| [gsd-quick](skills/gsd-quick) | claude | Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents |
| [gsd-resume-work](skills/gsd-resume-work) | claude | Resume work from previous session with full context restoration |
| [gsd-review](skills/gsd-review) | claude | Request cross-AI peer review of phase plans from external AI CLIs |
| [gsd-review-backlog](skills/gsd-review-backlog) | claude | Review and promote backlog items to active milestone |
| [gsd-secure-phase](skills/gsd-secure-phase) | claude | Retroactively verify threat mitigations for a completed phase |
| [gsd-settings](skills/gsd-settings) | claude | Configure GSD workflow toggles and model profile |
| [gsd-ship](skills/gsd-ship) | claude | Create PR, run review, and prepare for merge after verification passes |
| [gsd-sketch](skills/gsd-sketch) | claude | Sketch UI/design ideas with throwaway HTML mockups, or propose what to sketch next (frontier mode) |
| [gsd-spec-phase](skills/gsd-spec-phase) | claude | Clarify WHAT a phase delivers with ambiguity scoring; produces a SPEC.md before discuss-phase. |
| [gsd-spike](skills/gsd-spike) | claude | Spike an idea through experiential exploration, or propose what to spike next (frontier mode) |
| [gsd-stats](skills/gsd-stats) | claude | Display project statistics — phases, plans, requirements, git metrics, and timeline |
| [gsd-surface](skills/gsd-surface) | claude | Toggle which skills are surfaced — apply a profile, list, or disable a cluster without reinstall |
| [gsd-thread](skills/gsd-thread) | claude | Manage persistent context threads for cross-session work |
| [gsd-ui-phase](skills/gsd-ui-phase) | claude | Generate UI design contract (UI-SPEC.md) for frontend phases |
| [gsd-ui-review](skills/gsd-ui-review) | claude | Retroactive 6-pillar visual audit of implemented frontend code |
| [gsd-ultraplan-phase](skills/gsd-ultraplan-phase) | claude | [BETA] Offload plan phase to Claude Code's ultraplan cloud; review in browser and import back. |
| [gsd-undo](skills/gsd-undo) | claude | Safe git revert. Roll back phase or plan commits using the phase manifest with dependency checks. |
| [gsd-update](skills/gsd-update) | claude | Update GSD to latest version with changelog display |
| [gsd-validate-phase](skills/gsd-validate-phase) | claude | Retroactively audit and fill Nyquist validation gaps for a completed phase |
| [gsd-verify-work](skills/gsd-verify-work) | claude | Validate built features through conversational UAT |
| [gsd-workspace](skills/gsd-workspace) | claude | Manage GSD workspaces — create, list, or remove isolated workspace environments |
| [gsd-workstreams](skills/gsd-workstreams) | claude | Manage parallel workstreams — list, create, switch, status, progress, complete, and resume |
| [harness2-workflow](skills/harness2-workflow) | claude, grok | >- |
| [import-memory](skills/import-memory) | claude | Import a memory export from another AI assistant into Claude's memory — conversationally, additively, and with the content treated as data. |
| [ios-design-guidelines](skills/ios-design-guidelines) | claude, codex | Apple Human Interface Guidelines for iPhone. Use when building, reviewing, or refactoring SwiftUI/UIKit interfaces for iOS. Triggers on tasks involving iPhone UI, iOS components, accessibility, Dynami |
| [ipados-design-guidelines](skills/ipados-design-guidelines) | claude, codex | Apple Human Interface Guidelines for iPad. Use when building iPad-optimized interfaces, implementing multitasking, pointer support, keyboard shortcuts, or responsive layouts. Triggers on tasks involvi |
| [macos-design-guidelines](skills/macos-design-guidelines) | claude, codex | Apple Human Interface Guidelines for Mac. Use when building macOS apps with SwiftUI or AppKit, implementing menu bars, toolbars, window management, or keyboard shortcuts. Triggers on tasks involving M |
| [macos-patterns](skills/macos-patterns) | claude |  |
| [manager](skills/manager) | grok | >- |
| [microsoft-foundry](skills/microsoft-foundry) | codex | Build, deploy, evaluate, optimize, fine-tune, and manage Microsoft Foundry agents, models, and resources end to end. USE FOR: azd ai agent, azd provision/deploy, hosted agent scaffold/develop/run/depl |
| [morning](skills/morning) | claude | Render the user's morning brief as a styled HTML artifact, or set it up as a recurring weekday task. Use only when the user explicitly asks to run, see, or set up their morning brief, or if they invok |
| [motion-code](skills/motion-code) | claude | >- |
| [netlify-deploy](skills/netlify-deploy) | codex | Deploy web projects to Netlify using the Netlify CLI (`npx netlify`). Use when the user asks to deploy, host, publish, or link a site/repo on Netlify, including preview and production deploys. |
| [openai-docs](skills/openai-docs) | codex | Use when the user asks how to build with OpenAI products or APIs and needs up-to-date official documentation with citations, help choosing the latest model for a use case, or explicit GPT-5.4 upgrade  |
| [pdf](skills/pdf) | claude, codex | Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multiple PDFs into one, splitting PDFs apart, rota |
| [playwright](skills/playwright) | codex | Use when the task requires automating a real browser from the terminal (navigation, form filling, snapshots, screenshots, data extraction, UI-flow debugging) via `playwright-cli` or the bundled wrappe |
| [pptx](skills/pptx) | claude | Use this skill any time a .pptx or .potx file is involved in any way — as input, output, or both. This includes: creating slide decks, pitch decks, or presentations as PowerPoint (.pptx) files; readin |
| [prepare](skills/prepare) | codex |  |
| [preset](skills/preset) | codex | Intelligently deploys Azure OpenAI models to optimal regions by analyzing capacity across all available regions. Automatically checks current region first and shows alternatives if needed. USE FOR: qu |
| [python-appservice-deploy](skills/python-appservice-deploy) | codex | Deploy Python (Flask/Django/FastAPI) code to Azure App Service Linux. WHEN: \"Flask App Service\", \"Django App Service\", \"FastAPI App Service\", \"deploy Python to App Service\". DO NOT USE FOR: Co |
| [refactor-safely](skills/refactor-safely) | claude | Plan and execute safe refactoring using dependency analysis |
| [render-deploy](skills/render-deploy) | codex | Deploy applications to Render by analyzing codebases, generating render.yaml Blueprints, and providing Dashboard deeplinks. Use when the user wants to deploy, host, publish, or set up their applicatio |
| [reverse-engineer-anything](skills/reverse-engineer-anything) | codex | Reverse engineer native, managed, Electron/JavaScript, packaged, firmware, and browser targets with REA. Use shipped-artifact or requested runtime evidence to explain features, compare versions, decom |
| [review-changes](skills/review-changes) | claude | Perform a structured code review using change detection and impact |
| [scaffold](skills/scaffold) | codex |  |
| [site-veterinaria](skills/site-veterinaria) | claude | Cria e refina sites estáticos (HTML/CSS/JS puros, pt-BR) para clínicas, hospitais e serviços veterinários de Sorocaba usando só dados reais do negócio (CSV, briefs, data/content). Gera pelo script bui |
| [skill-creator](skills/skill-creator) | claude | Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill |
| [sora](skills/sora) | codex | Use when the user asks to generate, edit, extend, poll, list, download, or delete Sora videos, create reusable non-human Sora character references, or run local multi-video queues via the bundled CLI  |
| [transcribe](skills/transcribe) | codex | Transcribe audio files to text with optional diarization and known-speaker hints. Use when a user asks to transcribe speech from audio/video, extract text from recordings, or label speakers in intervi |
| [tvos-design-guidelines](skills/tvos-design-guidelines) | claude, codex | Apple Human Interface Guidelines for Apple TV. Use when building tvOS apps with focus-based navigation, Siri Remote input, or living room viewing experiences. Triggers on tasks involving Apple TV, tvO |
| [vercel-deploy](skills/vercel-deploy) | codex | Deploy applications and websites to Vercel. Use when the user requests deployment actions like "deploy my app", "deploy and give me the link", "push this live", or "create a preview deployment". |
| [visionos-design-guidelines](skills/visionos-design-guidelines) | claude, codex | Apple Human Interface Guidelines for Apple Vision Pro. Use when building spatial computing apps, implementing eye/hand input, or designing immersive experiences. Triggers on tasks involving visionOS,  |
| [watchos-design-guidelines](skills/watchos-design-guidelines) | claude, codex | Apple Human Interface Guidelines for Apple Watch. Use when building watchOS apps, complications, or workout features. Triggers on tasks involving Watch UI, Digital Crown, glanceable interfaces, or wri |
| [web-components](skills/web-components) | claude |  |
| [web-design-guidelines](skills/web-design-guidelines) | claude, codex | Web platform design and accessibility guidelines. Use when building web interfaces, auditing accessibility, implementing responsive layouts, or reviewing web UI code. Triggers on tasks involving HTML, |
| [xlsx](skills/xlsx) | claude | Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or fix an existing .xlsx, .xlsm, .xltx, .csv, or .tsv file (e. |
