# Jira Software: domain model (clean-room notes)

Research date: 2026-11-03. Written in my own words from public sources only. No Atlassian login, no product inspection.

## How to read this file

- **Sourced** = the claim comes from a public page I read (fetched, or seen as a search result summary). The source list is at the end.
- **Unverified** = I could not confirm it from a public source in this pass. It is general product knowledge and needs checking before the spec relies on it.
- Atlassian's own support pages mostly returned navigation text or truncated content when fetched. Where I could only see a search summary, I say so. A follow-up pass should re-read the official pages in full.

---

## 1. Projects

- **What it is.** The container for issues. Each project has a key (a short prefix such as `ABC`), its own issue types, workflows, boards and permissions. (Unverified: exact key rules; general product knowledge.)
- **Why teams need it.** Separates teams or products so their work, boards and reports do not mix.
- **Startup complexity.** Projects are cheap to create, so teams end up with many (one per squad, per client, per experiment). Each one carries its own schemes, boards and workflows to maintain. Tikka: one workspace, a few projects, shared settings by default.

## 2. Issue types

- **What it is.** A label on each issue that sets its kind (for example epic, story, task, bug, subtask) and the fields and workflow it uses. Sourced in outline: Atlassian treats issue types as configurable per project through an issue type scheme. (Source S3 search summary only.)
- **Why teams need it.** Lets reports count bugs separately from features, and lets a team use different fields for each kind.
- **Startup complexity.** Teams create custom types and then cannot say what each is for. Each extra type adds a workflow and a field set to maintain. Tikka: a small fixed set (Epic, Story, Task, Bug) and sub-tasks as a child relation, not a separate type.

## 3. Issue hierarchy (epic, story, task, sub-task)

- **What it is.** Issues sit on levels. Standard issues (story, task, bug) sit on one level. Epics sit above them and can hold child issues. Sub-tasks sit below a standard issue. Sourced: Jira Cloud gives each issue type a numeric level, with epics at level 1, standard issues at level 0 and sub-tasks at level -1. (Search summaries of third-party write-ups and Atlassian community posts, source S7; the level numbers came from a secondary summary, so treat them as needing a primary-source check.)
- **Epic children and sub-tasks.** Sourced: epics can hold both child stories and sub-tasks. Atlassian's knowledge base confirms that epics can have sub-tasks under them alongside child issues. (Source S5, search summary.)
- **Custom levels.** Sourced in summary: changing the default levels or adding new ones is limited to higher-tier plans. Premium users can add levels above epics through Advanced Roadmaps. Lower tiers need a Marketplace app. (Sources S6, S7 search summaries; plan-tier detail needs checking against the pricing page.)
- **Why teams need it.** Rolls small work up to a goal, so leaders can see progress without reading every ticket.
- **Startup complexity.** Two or three levels is enough for most startups. Custom levels (initiatives, portfolios) mostly serve portfolio management across many teams. Tikka: Epic → Story/Task → Sub-task, fixed. No custom levels in v1.

## 4. Workflows, statuses and transitions

- **What it is.** A workflow is the set of statuses an issue can be in and the transitions between them. A status is a step (for example To Do, In Progress, Done). A transition is a move between two statuses. Sourced: transitions are one-way, so going back and forth needs two separate transitions. (Source S1, search summary.)
- **Looped transitions.** Sourced: a transition can loop back to the same status and run an action, such as setting a field, without changing status. Atlassian calls these work item actions. (Source S1.)
- **Open vs closed.** Sourced: open or closed is decided by the Resolution field, not by the status name. An issue is open while Resolution is empty. (Source S1.)
- **Done transitions.** Sourced: Atlassian recommends a post-function on transitions into a Done status so Resolution is set automatically. (Source S1, search summary.)
- **Editing.** Sourced: built-in workflows cannot be edited but can be copied. (Source S1.)
- **Why teams need it.** Makes status meaningful, so boards, reports and automation agree on what "done" means.
- **Startup complexity.** Custom workflows per issue type, with validators, conditions and post-functions, are a common source of admin load. Many teams end up with near-identical workflows. Tikka: one fixed status set (Todo, In progress, In review, Done) with any move allowed. No conditions in v1.

## 5. Boards (Scrum and Kanban)

- **Scrum board.** Sourced: suited to teams that work in time-boxed sprints. Sprints are planned from the board's backlog. (Source S4, search summary.)
- **Kanban board.** Sourced: the work flows continuously, and work-in-progress limits cap how much can be in progress at once. Atlassian's older pages also say Kanban has no sprint concept. (Sources S4 and an older Atlassian getting-started page, search summary. The older page is for Jira Software Server, so the Cloud behaviour is unverified.)
- **Shared features.** Sourced: the two boards look alike but differ in practice and feature set. (Source S4.)
- **Why teams need it.** A visual view of work, filtered by project, sprint or assignee.
- **Startup complexity.** Two board types, each with its own settings, filters and swimlanes. Many teams run a hybrid they never configure properly. Tikka: one board with columns that follow the fixed statuses, plus a sprint view. No separate Scrum/Kanban modes.

## 6. Backlog

- **What it is.** The ordered list of work not yet in a sprint. Sourced: sprints are planned from the board's backlog. (Source S4.)
- **Why teams need it.** One place to rank and refine work before it is pulled into a sprint.
- **Startup complexity.** Backlogs grow with no owner and turn into archives. Tikka: one ordered backlog per project, with a simple "move to sprint" action, and a "stale" marker instead of heavy grooming tools.

## 7. Sprints

- **What it is.** A time-boxed period of planned work on a Scrum board. Sourced: sprints are the planning unit for Scrum boards. (Source S4.)
- **Why teams need it.** Forces a planning rhythm and gives a basis for velocity and burndown reports.
- **Startup complexity.** Sprint start and end dates, carry-over rules and reporting pull in board configuration. Unverified: exact carry-over behaviour in Cloud. Tikka: sprints with a name, start date, end date and a status (planned, active, closed). Unfinished issues move to the backlog or the next sprint on close, chosen explicitly.

## 8. Versions and releases

- **What it is.** Named release targets that issues can be assigned to (often called fix versions). Unverified in this pass: exact field names and release-page behaviour in Cloud.
- **Why teams need it.** Tells customers and support what shipped in which build.
- **Startup complexity.** Useful for product teams that ship on a schedule, rarely for teams that deploy continuously. Tikka: defer to later. Use a free-text "release" label in v1 if needed.

## 9. Components

- **What it is.** A tag that groups issues by part of the product or codebase. Unverified in this pass.
- **Why teams need it.** Routing and reporting by area.
- **Startup complexity.** Overlaps with labels and projects. Teams often have both and use neither well. Tikka: labels only. No components in v1.

## 10. Labels

- **What it is.** Free-text tags on issues. Unverified in this pass for Cloud behaviour.
- **Why teams need it.** Cheap, flexible grouping and filtering.
- **Startup complexity.** Low, but unmanaged labels turn into duplicates (`bug`, `Bug`, `bugs`). Tikka: labels with a picker that suggests existing ones, so duplicates are less likely.

## 11. Priorities

- **What it is.** A ranked level on each issue, with names such as Highest to Lowest. Unverified in this pass for default names.
- **Why teams need it.** Sorting and triage.
- **Startup complexity.** Five levels that nobody agrees on. Tikka: three levels (High, Medium, Low), or a manual order in the backlog instead.

## 12. Fields

- **What it is.** Each issue has system fields (summary, status, assignee) and custom fields, and fields can be attached to issue types through screens and schemes. Unverified in this pass.
- **Why teams need it.** Captures structured data beyond the title and description.
- **Startup complexity.** Field and screen configuration is one of the biggest admin burdens. Tikka: a fixed field set. No custom fields in v1. Revisit once real demand appears.

## 13. JQL (Jira Query Language)

- **What it is.** A query language for searching issues by field values, status, dates and so on. Unverified in this pass for syntax details.
- **Why teams need it.** Power users build saved filters and dashboards with it.
- **Startup complexity.** High for non-technical team members; a source of "where did my issues go" support questions. Tikka: filters in the UI, and a plain text search. No query language in v1.

## 14. Permission schemes

- **What it is.** Rules that decide who can see, create, edit, transition and administer issues and projects. Unverified in this pass for Cloud detail.
- **Why teams need it.** Protects sensitive projects and separates client or contractor access.
- **Startup complexity.** Schemes are assigned per project and combined with groups and roles. Misconfiguration is common. Tikka: workspace roles (owner, admin, member, guest) with project-level visibility as one toggle. No custom schemes in v1.

## 15. Notifications

- **What it is.** Rules that decide who gets an email or in-app message on events such as assignment or comment. Unverified in this pass for Cloud detail.
- **Why teams need it.** Keeps people informed without them watching every ticket.
- **Startup complexity.** Notification schemes multiply per project and become noise. Tikka: watch and mention based notifications, with one per-user setting. No notification schemes in v1.

---

## Sources

Read date for all: 2026-11-03.

- S1. Overview of Jira Cloud workflows: https://support.atlassian.com/jira-service-management-cloud/docs/overview-of-jira-cloud-workflows/ (search result summary; Atlassian page)
- S2. Create workflow transitions: https://support.atlassian.com/jira-cloud-administration/docs/create-workflow-transitions/ (search result summary; not used for claims above beyond S1)
- S3. Jira work items overview: https://www.atlassian.com/software/jira/guides/issues/overview (fetch returned navigation only; cited for topic only, no claim relies on it)
- S4. Jira boards overview: https://www.atlassian.com/software/jira/guides/boards/overview (fetch returned truncated content; claims rely on search summary)
- S5. Jira epic issues have subtasks under them along with child issues: https://confluence.atlassian.com/jirakb/jira-epic-issues-have-subtasks-under-them-along-with-child-issues-1431770228.html (search summary)
- S6. Configuring hierarchy levels (Advanced Roadmaps): https://confluence.atlassian.com/jiraportfoliocloud/configuring-hierarchy-levels-828785179.html (search summary)
- S7. Atlassian Community thread on hierarchy possibilities: https://community.atlassian.com/forums/Jira-questions/Hierarchy-posibilites-in-Jira/qaq-p/2669411 (search summary; third-party-quality source, used only to corroborate S5 and S6)

## Gaps in this file

- Most Atlassian claims come from search summaries. A full read of S1, S4 and the Cloud issue-type page is still needed.
- Sections 8 to 15 contain unverified general knowledge and need public sources in a follow-up pass.
