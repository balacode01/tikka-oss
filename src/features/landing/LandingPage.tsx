import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '../../components/Button'
import { useSession } from '../../app/session-context'

// The address of wherever this copy of Tikka is running, so self-hosted copies show their own endpoint.
const MCP_URL = `${window.location.origin}/api/mcp`
const ADD_COMMAND = `claude mcp add --transport http tikka ${MCP_URL}`

const FEATURES = [
  { name: 'Board', detail: 'Issues in columns by status. Drag a card to change its status.' },
  { name: 'Backlog', detail: 'Issues not yet in a sprint, in rank order. Plan and start sprints here.' },
  { name: 'List', detail: 'All issues in a table, for sorting and scanning.' },
  { name: 'Sprints', detail: 'Time-boxed plans for Scrum projects, with goals, dates and progress.' },
]

const EXAMPLES = ['List my Tikka projects', 'What is assigned to me in Tikka?', 'Create a bug in MOB called "Login fails on iOS"']

const TOOL_GROUPS = [
  'Workspaces and projects: list, create',
  'Sprints: create, start, complete',
  'Issues: list, get, create, update, move, bulk update, delete',
  'Comments, labels, links and watchers',
  'Search, your work and invites',
]

const TROUBLESHOOTING = [
  { problem: 'Projects list is empty', fix: 'You are signed in to a different account. Run /mcp, clear the tikka authentication, then sign in with the account that owns the project.' },
  { problem: 'Cannot connect or ENOTFOUND', fix: `Check that the URL is exactly ${MCP_URL}.` },
  { problem: '401 or sign-in keeps appearing', fix: 'Run /mcp, choose tikka, and authenticate again.' },
]

// Copies a command to the clipboard. Clipboard access can be blocked, so a failure just shows no confirmation.
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-medium text-text-primary hover:bg-surface-hover"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-header p-3">
      <code className="min-w-0 break-all font-mono text-sm text-text-primary">{code}</code>
      <CopyButton value={code} />
    </div>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-semibold text-on-primary text-xs tabular-nums">
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pb-6">
        <h3 className="font-semibold text-base text-text-primary">{title}</h3>
        {children}
      </div>
    </li>
  )
}

// Public front page. Signed-in people get a direct way into the app; everyone gets the Claude Code guide.
export function LandingPage() {
  const { session, loading } = useSession()
  const { hash } = useLocation()

  // React Router does not scroll to a hash on navigation, so the section is scrolled into view here.
  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  const signedIn = !loading && session !== null

  return (
    <div className="flex min-h-screen flex-col bg-surface-page text-text-primary">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-border border-b bg-surface-page/95 px-4 py-3 backdrop-blur md:px-16">
        <Link to="/" className="font-semibold text-xl text-text-primary">
          Tikka
        </Link>
        <nav aria-label="Main" className="flex items-center gap-3">
          <a href="#claude-code" className="hidden text-sm font-medium text-text-secondary hover:text-text-primary sm:inline">
            MCP server
          </a>
          {signedIn ? (
            <Link to="/home">
              <Button variant="primary">Open Tikka</Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button>Log in</Button>
              </Link>
              <Link to="/signup">
                <Button variant="primary">Sign up</Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="flex flex-col gap-16 px-4 py-12 md:px-16 md:py-16">
        <section className="flex max-w-[640px] flex-col gap-6">
          <h1 className="font-semibold text-4xl text-text-primary md:text-5xl">Plan, track and ship work with your team.</h1>
          <p className="text-lg leading-7 text-text-secondary">
            Keep your work as issues, arrange them on a board, and plan them into sprints. Everything sits inside a workspace, so your team only sees its own work.
          </p>
          <div className="flex flex-wrap gap-3">
            {signedIn ? (
              <Link to="/home">
                <Button variant="primary">Open Tikka</Button>
              </Link>
            ) : (
              <Link to="/signup">
                <Button variant="primary">Sign up</Button>
              </Link>
            )}
            {!signedIn && (
              <Link to="/login">
                <Button>Log in</Button>
              </Link>
            )}
          </div>
        </section>

        <section aria-labelledby="features-heading" className="flex flex-col gap-6">
          <h2 id="features-heading" className="font-semibold text-2xl text-text-primary">
            What you get
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.name} className="flex flex-col gap-2 rounded-md border border-border bg-surface-raised p-5">
                <span className="font-semibold text-base">{feature.name}</span>
                <span className="text-sm leading-5 text-text-secondary">{feature.detail}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="claude-code" aria-labelledby="claude-code-heading" className="flex scroll-mt-20 max-w-[760px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 id="claude-code-heading" className="font-semibold text-2xl text-text-primary">
              Connect Claude Code
            </h2>
            <p className="text-base leading-6 text-text-secondary">
              Ask Claude Code about your Tikka work in plain language: list projects, see what is assigned to you, or create and update issues. It uses your own account and only shows what you can see on the website.
            </p>
          </div>

          <ol className="flex flex-col">
            <Step number={1} title="Check what you need first">
              <ul className="list-disc pl-5 text-sm leading-6 text-text-secondary">
                <li>Claude Code installed on your computer</li>
                <li>A Tikka account and at least one workspace you belong to</li>
              </ul>
            </Step>

            <Step number={2} title="Add Tikka to Claude Code">
              <p className="text-sm leading-6 text-text-secondary">Run this command in your terminal.</p>
              <CodeBlock code={ADD_COMMAND} />
            </Step>

            <Step number={3} title="Sign in to Tikka">
              <p className="text-sm leading-6 text-text-secondary">
                Open Claude Code, run <code className="font-mono text-text-primary">/mcp</code>, choose <strong className="font-medium text-text-primary">tikka</strong>, then choose Authenticate. A browser opens. Log in to Tikka and approve access. Claude Code shows “Authentication successful”.
              </p>
            </Step>

            <Step number={4} title="Try it">
              <p className="text-sm leading-6 text-text-secondary">Ask Claude Code something like:</p>
              <ul className="flex flex-col gap-2">
                {EXAMPLES.map((example) => (
                  <li key={example}>
                    <CodeBlock code={example} />
                  </li>
                ))}
              </ul>
            </Step>

            <Step number={5} title="What Claude Code can do">
              <ul className="list-disc pl-5 text-sm leading-6 text-text-secondary">
                {TOOL_GROUPS.map((group) => (
                  <li key={group}>{group}</li>
                ))}
              </ul>
              <p className="text-sm leading-6 text-text-secondary">
                The same rules as the website apply. A guest can read and comment, but cannot change issues, sprints or project settings.
              </p>
            </Step>
          </ol>

          <div className="flex flex-col gap-3 border-border border-t pt-6">
            <h3 className="font-semibold text-base text-text-primary">Troubleshooting</h3>
            <dl className="flex flex-col gap-3">
              {TROUBLESHOOTING.map((item) => (
                <div key={item.problem} className="flex flex-col gap-1 rounded-md border border-border p-4">
                  <dt className="font-medium text-sm text-text-primary">{item.problem}</dt>
                  <dd className="text-sm leading-5 text-text-secondary">{item.fix}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-border border-t px-4 py-6 text-sm text-text-secondary md:px-16">
        <span>
          Tikka is open source under the{' '}
          <a href="https://github.com/balacode01/tikka-oss/blob/main/LICENSE" className="hover:text-text-primary">
            MIT License
          </a>
          {' · '}
          <a href="https://github.com/balacode01/tikka-oss" className="hover:text-text-primary">
            Source on GitHub
          </a>
        </span>
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          <Link to="/login" className="hover:text-text-primary">Log in</Link>
          <Link to="/signup" className="hover:text-text-primary">Sign up</Link>
          <Link to="/help" className="hover:text-text-primary">Help</Link>
        </nav>
      </footer>
    </div>
  )
}
