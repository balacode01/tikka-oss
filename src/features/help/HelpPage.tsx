import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { StatusPill } from '../board/StatusPill'
import { PRIORITY_ICON, TYPE_ICON } from '../board/issueIcons'
import { supabase } from '../../lib/supabase'

const SECTIONS = [
  { id: 'what', title: 'What Tikka is' },
  { id: 'structure', title: 'How it fits together' },
  { id: 'start', title: 'Get started' },
  { id: 'screens', title: 'Screens' },
  { id: 'statuses', title: 'Statuses, types and priorities' },
  { id: 'roles', title: 'Roles' },
  { id: 'shortcuts', title: 'Keyboard shortcuts' },
  { id: 'missing', title: 'Not available yet' },
  { id: 'claude-code', title: 'Claude Code' },
]

const HIERARCHY = [
  { name: 'Workspace', detail: 'Your company or team, for example Lumen Labs. Holds the people and the projects.' },
  { name: 'Project', detail: 'A body of work with its own issues and statuses, for example Mobile app, key MOB.' },
  { name: 'Sprint', detail: 'A time-boxed plan inside a Scrum project, for example Sprint 14. Kanban projects have none.' },
  { name: 'Issue', detail: 'One piece of work, with a key such as MOB-147. It sits in a project, and in a sprint or the backlog.' },
]

const VIEWS = [
  { name: 'Board', detail: 'Issues in columns by status. Drag a card to change its status.' },
  { name: 'Backlog', detail: 'Issues not yet in a sprint, in rank order. Plan and start sprints here.' },
  { name: 'List', detail: 'All issues in a table.' },
]

const SCREENS = [
  { name: 'Your work', detail: 'Issues assigned to you, your projects, recently viewed issues, what is due this week and recent activity.' },
  { name: 'Board', detail: 'The issues of one project, by status. Shows the active sprint on Scrum projects.' },
  { name: 'Backlog', detail: 'Plan sprints, and see the issues that are not in one yet.' },
  { name: 'List', detail: 'A flat table of a project’s issues, for sorting and scanning.' },
  { name: 'Profile settings', detail: 'Your name, job title, time zone and theme. Open it from your avatar menu.' },
]

const ROLES = [
  { role: 'Owner', can: 'Full access to the workspace, including inviting people.' },
  { role: 'Admin', can: 'Can invite people, and works on issues and sprints like a member.' },
  { role: 'Member', can: 'Creates and changes issues and sprints in projects they can see.' },
  { role: 'Guest', can: 'Reads and comments on the projects they are invited to. Cannot change issues, sprints or project settings.' },
]

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], alt: 'Cmd K', where: 'Anywhere', what: 'Search issues by key or title.' },
  { keys: ['C'], where: 'Board', what: 'Create an issue. Not while you are typing in a field.' },
  { keys: ['Ctrl', 'Enter'], alt: 'Cmd Enter', where: 'Create issue dialog', what: 'Create the issue.' },
]

const NOT_AVAILABLE = [
  'Notifications',
  'Custom statuses and workflows. Every project uses the default statuses.',
  'Project and workspace settings',
  'Moving an issue to another project',
  'Live updates. Changes from other people appear after you reload the page.',
]

const STATUS_EXAMPLES = [
  { name: 'To do', category: 'todo' as const, detail: 'Not started yet. Also includes Weekly Target and Today’s Task.' },
  { name: 'In progress', category: 'in_progress' as const, detail: 'Being worked on. Also includes Unit Testing and On-hold.' },
  { name: 'Done', category: 'done' as const, detail: 'Finished. Also includes Fixed. Done issues leave the Open tab on Your work.' },
]

// Help for new and existing users. Each topic is its own card: a numbered heading, a one-line summary,
// then the content. Legends use the board's own icon and status components, so they stay accurate.
export function HelpPage() {
  const workspaces = useQuery({
    queryKey: ['my-workspaces'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces').select('id, name, slug').order('created_at')
      if (error) throw error
      return data
    },
  })
  const slug = workspaces.data?.[0]?.slug

  return (
    <div className="flex w-full max-w-[760px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl text-text-primary">Help</h1>
        <p className="text-base leading-6 text-text-secondary">How Tikka fits together, and how to get started.</p>
      </div>

      <nav aria-label="On this page" className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-2 border-border border-b bg-surface-page/95 px-1 py-3 backdrop-blur">
        {SECTIONS.map((section, index) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="inline-flex h-8 items-center gap-2 rounded-full border border-border-strong bg-surface-raised px-3 text-sm font-medium text-text-primary hover:bg-surface-hover"
          >
            <span className="tabular-nums text-text-secondary">{index + 1}</span>
            {section.title}
          </a>
        ))}
      </nav>

      <HelpSection id="what" number={1} title="What Tikka is" summary="A tool for planning and tracking your team's work.">
        <p className="text-[15px] leading-6">
          You keep the work as issues, arrange them on a board, and plan them into sprints. Everything sits inside a workspace, so your team only sees its own work.
        </p>
      </HelpSection>

      <HelpSection id="structure" number={2} title="How it fits together" summary="Each level contains the one below it.">
        <ol className="flex flex-col">
          {HIERARCHY.map((level, index) => (
            <li key={level.name} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-on-primary tabular-nums">
                  {index + 1}
                </span>
                {index < HIERARCHY.length - 1 && <span className="my-1 w-px flex-1 bg-border-strong" aria-hidden="true" />}
              </div>
              <div className="flex flex-col gap-1 pb-5">
                <span className="font-semibold text-[15px]">{level.name}</span>
                <span className="text-[15px] leading-6 text-text-secondary">{level.detail}</span>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-3 border-border border-t pt-5">
          <h3 className="font-semibold text-[15px]">Three views of one project</h3>
          <p className="text-[15px] leading-6 text-text-secondary">
            The Board, Backlog and List show the same issues in different ways. They hold no data of their own, so a change in one shows in the others.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {VIEWS.map((view) => (
              <div key={view.name} className="flex flex-col gap-1 rounded-md border border-border p-4">
                <span className="font-semibold text-sm">{view.name}</span>
                <span className="text-sm leading-5 text-text-secondary">{view.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </HelpSection>

      <HelpSection id="start" number={3} title="Get started" summary="Five steps from an empty workspace to a planned sprint.">
        <ol className="flex flex-col gap-5">
          <Step number={1} title="Create a workspace">
            Name your company or team.
          </Step>
          <Step number={2} title="Create a project">
            Give it a name and a key of 2 to 10 capital letters, such as MOB. Choose Scrum for sprints, or Kanban for continuous flow.
            {slug && (
              <div className="mt-3">
                <Link to={`/w/${slug}/projects/new`} className="inline-flex h-8 items-center rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-medium hover:bg-surface-hover">
                  Create a project
                </Link>
              </div>
            )}
          </Step>
          <Step number={3} title="Create an issue">
            Use Create issue in the top bar, or press C on a board. Issues get keys such as MOB-1.
          </Step>
          <Step number={4} title="Move it across the board">
            Open a project from the sidebar, then drag the card to the column for its new status.
          </Step>
          <Step number={5} title="Plan a sprint">
            On a Scrum project, open the Backlog, create a sprint, move issues into it, then start it.
          </Step>
        </ol>
      </HelpSection>

      <HelpSection id="screens" number={4} title="Screens" summary="What each part of the app is for.">
        <div className="grid gap-3 sm:grid-cols-2">
          {SCREENS.map((screen) => (
            <div key={screen.name} className="flex flex-col gap-1 rounded-md border border-border p-4">
              <span className="font-semibold text-[15px]">{screen.name}</span>
              <span className="text-[15px] leading-6 text-text-secondary">{screen.detail}</span>
            </div>
          ))}
        </div>
      </HelpSection>

      <HelpSection id="statuses" number={5} title="Statuses, types and priorities" summary="Every status belongs to one of three groups. The name always shows, so colour is never the only clue.">
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold text-[15px]">Statuses</h3>
          <ul className="flex flex-col divide-y divide-border">
            {STATUS_EXAMPLES.map((status) => (
              <li key={status.name} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="sm:w-32 sm:shrink-0">
                  <StatusPill status={{ name: status.name, category: status.category }} />
                </span>
                <span className="text-[15px] leading-6 text-text-secondary">{status.detail}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 border-border border-t pt-5">
          <h3 className="font-semibold text-[15px]">Issue types</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.values(TYPE_ICON).map((type) => {
              const Icon = type.icon
              return (
                <li key={type.label} className="flex items-center gap-3 rounded-md border border-border px-4 py-3 text-[15px]">
                  <Icon className={`size-5 shrink-0 ${type.color}`} aria-hidden="true" />
                  {type.label}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-3 border-border border-t pt-5">
          <h3 className="font-semibold text-[15px]">Priorities</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.entries(PRIORITY_ICON).map(([key, priority]) => {
              const Icon = priority.icon
              return (
                <li key={key} className="flex items-center gap-3 rounded-md border border-border px-4 py-3 text-[15px]">
                  <Icon className="size-5 shrink-0 text-text-secondary" aria-hidden="true" />
                  {priority.label}
                </li>
              )
            })}
            <li className="flex items-center gap-3 rounded-md border border-border px-4 py-3 text-[15px]">
              <span className="grid size-5 place-items-center rounded-full bg-danger-bg text-xs font-semibold text-danger-text" aria-hidden="true">!</span>
              Urgent, shown in red so it stands out
            </li>
          </ul>
        </div>
      </HelpSection>

      <HelpSection id="roles" number={6} title="Roles" summary="Each person has one role in a workspace.">
        <ul className="flex flex-col divide-y divide-border">
          {ROLES.map((role) => (
            <li key={role.role} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
              <span className="font-semibold text-[15px] sm:w-24 sm:shrink-0">{role.role}</span>
              <span className="text-[15px] leading-6 text-text-secondary">{role.can}</span>
            </li>
          ))}
        </ul>
        <p className="text-[15px] leading-6 text-text-secondary">Owners and admins can invite people from Invite people in the sidebar.</p>
      </HelpSection>

      <HelpSection id="shortcuts" number={7} title="Keyboard shortcuts" summary="Press these keys from anywhere they are listed.">
        <ul className="flex flex-col divide-y divide-border">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.what} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-6">
              <span className="flex flex-wrap items-center gap-1.5 sm:w-48 sm:shrink-0">
                {shortcut.keys.map((key) => (
                  <kbd key={key} className="rounded-sm border border-border-strong bg-surface-page px-2 py-0.5 font-mono text-xs font-medium">
                    {key}
                  </kbd>
                ))}
                {shortcut.alt && <span className="text-xs text-text-secondary">or {shortcut.alt}</span>}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px]">{shortcut.what}</span>
                <span className="text-sm text-text-secondary">Works on: {shortcut.where}</span>
              </span>
            </li>
          ))}
        </ul>
      </HelpSection>

      <HelpSection id="missing" number={8} title="Not available yet" summary="These are not part of Tikka today.">
        <ul className="flex flex-col gap-3">
          {NOT_AVAILABLE.map((item) => (
            <li key={item} className="flex gap-3 text-[15px] leading-6 text-text-secondary">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </HelpSection>

      <HelpSection id="claude-code" number={9} title="Claude Code" summary="Ask Claude Code about your Tikka work in plain language.">
        <p className="text-[15px] leading-6">
          Add Tikka to Claude Code once, then sign in from the <span className="font-mono">/mcp</span> menu. Claude Code then works with your projects, sprints and issues, with the same permissions you have here.
        </p>
        <Link to="/#claude-code" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
          Set up Claude Code
        </Link>
      </HelpSection>
    </div>
  )
}

function HelpSection({ id, number, title, summary, children }: { id: string; number: number; title: string; summary: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 overflow-hidden rounded-lg border border-border bg-surface-raised">
      <header className="flex items-start gap-4 border-border border-b bg-surface-page px-5 py-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-selected text-sm font-semibold tabular-nums text-text-primary">{number}</span>
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-lg text-text-primary">{title}</h2>
          <p className="text-sm leading-5 text-text-secondary">{summary}</p>
        </div>
      </header>
      <div className="flex flex-col gap-5 p-5 text-text-primary">{children}</div>
    </section>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border-strong text-xs font-semibold tabular-nums">{number}</span>
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-[15px]">{title}</span>
        <div className="text-[15px] leading-6 text-text-secondary">{children}</div>
      </div>
    </li>
  )
}
