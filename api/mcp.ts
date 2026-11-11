/// <reference types="node" />
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Tikka's MCP endpoint (/api/mcp). Every request must carry the signed-in person's Supabase access token as
// "Authorization: Bearer <token>". Tools query Supabase with that token, so Row Level Security decides what
// the person can see or change. The service role key is never used here.
function userClient(token: string) {
  return createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const uuid = z.uuid()
const priority = z.enum(['urgent', 'high', 'medium', 'low'])
const issueType = z.enum(['epic', 'story', 'task', 'bug', 'subtask'])
const template = z.enum(['scrum', 'kanban'])
const access = z.enum(['open', 'invite_only'])
const inviteRole = z.enum(['admin', 'member', 'guest'])
const linkType = z.enum(['blocks', 'relates_to'])

const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value ?? null, null, 2) }] })
const failed = (message: string) => ({ isError: true as const, content: [{ type: 'text' as const, text: message }] })

function buildServer(token: string) {
  const server = new McpServer({ name: 'tikka', version: '0.1.0' })
  const db = userClient(token)

  // The person's user id, needed where a row records who did something (comments, links, watchers).
  async function currentUserId() {
    const { data } = await db.auth.getUser(token)
    return data.user?.id ?? null
  }

  // Workspaces, projects, statuses and sprints

  server.registerTool(
    'list_workspaces',
    { description: 'List the Tikka workspaces you belong to.', inputSchema: {} },
    async () => {
      const { data, error } = await db.from('workspaces').select('id, name, slug').order('created_at')
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'create_workspace',
    {
      description: 'Create a workspace. You become its owner.',
      inputSchema: {
        name: z.string().min(1).max(100),
        slug: z.string().describe('Lowercase letters, digits and hyphens, 3 to 60 characters.'),
      },
    },
    async ({ name, slug }) => {
      const { data, error } = await db.rpc('create_workspace', { p_name: name, p_slug: slug })
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'create_project',
    {
      description: 'Create a project in a workspace. Adds default statuses and makes you the lead.',
      inputSchema: {
        workspace_id: uuid,
        name: z.string().min(1).max(100),
        key: z.string().regex(/^[A-Z]{2,10}$/).describe('Two to ten capital letters, used as the issue key prefix.'),
        template: template,
        access: access.default('open'),
      },
    },
    async ({ workspace_id, name, key, template: projectTemplate, access: projectAccess }) => {
      const { data, error } = await db.rpc('create_project', {
        p_workspace: workspace_id,
        p_name: name,
        p_key: key,
        p_template: projectTemplate,
        p_access: projectAccess,
      })
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'list_statuses',
    {
      description: 'List a project\'s statuses (columns) in board order.',
      inputSchema: { project_id: uuid },
    },
    async ({ project_id }) => {
      const { data, error } = await db
        .from('statuses')
        .select('id, name, category, position')
        .eq('project_id', project_id)
        .order('position')
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'list_sprints',
    {
      description: 'List a project\'s sprints with their state, dates and goal.',
      inputSchema: { project_id: uuid },
    },
    async ({ project_id }) => {
      const { data, error } = await db
        .from('sprints')
        .select('id, name, goal, state, start_date, end_date, completed_at')
        .eq('project_id', project_id)
        .order('created_at')
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'create_sprint',
    {
      description: 'Create a planned sprint in a project.',
      inputSchema: {
        project_id: uuid,
        name: z.string().min(1).max(100),
        goal: z.string().max(500).optional(),
      },
    },
    async ({ project_id, name, goal }) => {
      const { data, error } = await db.rpc('create_sprint', { p_project: project_id, p_name: name, p_goal: goal ?? null })
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'start_sprint',
    {
      description: 'Start a planned sprint. A project can have only one active sprint at a time.',
      inputSchema: {
        sprint_id: uuid,
        goal: z.string().max(500).optional(),
        end_date: z.iso.date().optional().describe('YYYY-MM-DD'),
      },
    },
    async ({ sprint_id, goal, end_date }) => {
      const { data, error } = await db.rpc('start_sprint', {
        p_sprint: sprint_id,
        p_goal: goal ?? null,
        p_end_date: end_date ?? null,
      })
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'complete_sprint',
    {
      description: 'Complete an active sprint. Open issues move to the backlog, or to the sprint given in move_open_to.',
      inputSchema: {
        sprint_id: uuid,
        move_open_to: uuid.optional().describe('Sprint that receives the open issues. Omit to move them to the backlog.'),
      },
    },
    async ({ sprint_id, move_open_to }) => {
      const { data, error } = await db.rpc('complete_sprint', { p_sprint: sprint_id, p_move_open_to: move_open_to ?? null })
      return error ? failed(error.message) : text(data)
    },
  )

  // Issues

  server.registerTool(
    'list_issues',
    {
      description: 'List issues in a project, optionally filtered by sprint, status or assignee.',
      inputSchema: {
        project_id: uuid,
        sprint_id: uuid.optional(),
        status_id: uuid.optional(),
        assignee_id: uuid.optional(),
        limit: z.number().int().min(1).max(200).default(50),
      },
    },
    async ({ project_id, sprint_id, status_id, assignee_id, limit }) => {
      let query = db
        .from('issues')
        .select('id, key, type, title, priority, status_id, assignee_id, sprint_id, story_points, due_date, updated_at')
        .eq('project_id', project_id)
        .is('deleted_at', null)
        .order('number')
        .limit(limit)
      if (sprint_id) query = query.eq('sprint_id', sprint_id)
      if (status_id) query = query.eq('status_id', status_id)
      if (assignee_id) query = query.eq('assignee_id', assignee_id)

      const { data, error } = await query
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'get_issue',
    {
      description: 'Get one issue by its key (for example MOB-12), with its labels, comments and links.',
      inputSchema: { key: z.string().regex(/^[A-Z]{2,10}-\d+$/) },
    },
    async ({ key }) => {
      const { data: issue, error } = await db.from('issues').select('*').eq('key', key).is('deleted_at', null).maybeSingle()
      if (error) return failed(error.message)
      if (!issue) return failed(`No issue ${key} that you can see.`)

      const [labels, comments, links] = await Promise.all([
        db.from('issue_labels').select('label').eq('issue_id', issue.id).order('label'),
        db
          .from('comments')
          .select('id, author_id, body, created_at, edited_at')
          .eq('issue_id', issue.id)
          .is('deleted_at', null)
          .order('created_at'),
        db.from('issue_links').select('id, link_type, source_issue_id, target_issue_id').or(`source_issue_id.eq.${issue.id},target_issue_id.eq.${issue.id}`),
      ])
      const failure = labels.error ?? comments.error ?? links.error
      if (failure) return failed(failure.message)

      return text({
        ...issue,
        labels: labels.data?.map((row) => row.label) ?? [],
        comments: comments.data ?? [],
        links: links.data ?? [],
      })
    },
  )

  server.registerTool(
    'create_issue',
    {
      description: 'Create an issue in a project. Status defaults to the project\'s default status.',
      inputSchema: {
        project_id: uuid,
        type: issueType,
        title: z.string().min(1).max(255),
        description: z.string().max(20000).optional(),
        status_id: uuid.optional(),
        priority: priority.default('medium'),
        assignee_id: uuid.optional(),
        sprint_id: uuid.optional(),
        epic_id: uuid.optional(),
        parent_id: uuid.optional(),
        story_points: z.number().min(0).optional(),
        due_date: z.iso.date().optional().describe('YYYY-MM-DD'),
        labels: z.array(z.string().min(1).max(50)).optional(),
      },
    },
    async (input) => {
      const { data, error } = await db.rpc('create_issue', {
        p_project: input.project_id,
        p_type: input.type,
        p_title: input.title,
        p_description: input.description ?? null,
        p_status: input.status_id ?? null,
        p_priority: input.priority,
        p_assignee: input.assignee_id ?? null,
        p_sprint: input.sprint_id ?? null,
        p_epic: input.epic_id ?? null,
        p_parent: input.parent_id ?? null,
        p_points: input.story_points ?? null,
        p_due: input.due_date ?? null,
        p_labels: input.labels ?? [],
      })
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'update_issue',
    {
      description: 'Change fields on an issue. Only the fields you pass are changed. Pass null to clear a field.',
      inputSchema: {
        issue_id: uuid,
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(20000).nullable().optional(),
        priority: priority.optional(),
        assignee_id: uuid.nullable().optional(),
        sprint_id: uuid.nullable().optional(),
        story_points: z.number().min(0).nullable().optional(),
        due_date: z.iso.date().nullable().optional(),
      },
    },
    async ({ issue_id, ...fields }) => {
      const changes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined))
      if (Object.keys(changes).length === 0) return failed('Nothing to change: pass at least one field.')

      const { data, error } = await db.from('issues').update(changes).eq('id', issue_id).select('id, key, title').maybeSingle()
      if (error) return failed(error.message)
      return data ? text(data) : failed('No issue with that id that you can edit.')
    },
  )

  server.registerTool(
    'move_issue',
    {
      description: 'Move an issue to another status (column). Optionally place it before or after another issue.',
      inputSchema: {
        issue_id: uuid,
        status_id: uuid,
        before_id: uuid.optional().describe('Place the issue above this issue.'),
        after_id: uuid.optional().describe('Place the issue below this issue.'),
      },
    },
    async ({ issue_id, status_id, before_id, after_id }) => {
      const { data, error } = await db.rpc('move_issue', {
        p_issue: issue_id,
        p_status: status_id,
        p_before: before_id ?? null,
        p_after: after_id ?? null,
      })
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'bulk_update_issues',
    {
      description: 'Move several issues to a sprint and/or assign them. Pass null to clear the sprint or assignee.',
      inputSchema: {
        issue_ids: z.array(uuid).min(1).max(200),
        sprint_id: uuid.nullable().optional(),
        assignee_id: uuid.nullable().optional(),
      },
    },
    async ({ issue_ids, sprint_id, assignee_id }) => {
      const { data, error } = await db.rpc('bulk_update_issues', {
        p_ids: issue_ids,
        p_sprint: sprint_id ?? null,
        p_assignee: assignee_id ?? null,
        p_set_sprint: sprint_id !== undefined,
        p_set_assignee: assignee_id !== undefined,
      })
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'delete_issues',
    {
      description: 'Delete issues (soft delete: they leave the board but are kept in the database). Returns the number deleted.',
      inputSchema: { issue_ids: z.array(uuid).min(1).max(200) },
    },
    async ({ issue_ids }) => {
      const { data, error } = await db.rpc('delete_issues', { p_ids: issue_ids })
      return error ? failed(error.message) : text({ deleted: data })
    },
  )

  server.registerTool(
    'add_label',
    {
      description: 'Add a label to an issue.',
      inputSchema: { issue_id: uuid, label: z.string().min(1).max(50) },
    },
    async ({ issue_id, label }) => {
      const { error } = await db.from('issue_labels').insert({ issue_id, label })
      return error ? failed(error.message) : text({ added: label })
    },
  )

  server.registerTool(
    'remove_label',
    {
      description: 'Remove a label from an issue.',
      inputSchema: { issue_id: uuid, label: z.string().min(1).max(50) },
    },
    async ({ issue_id, label }) => {
      const { error } = await db.from('issue_labels').delete().eq('issue_id', issue_id).eq('label', label)
      return error ? failed(error.message) : text({ removed: label })
    },
  )

  server.registerTool(
    'add_comment',
    {
      description: 'Add a comment to an issue as yourself.',
      inputSchema: { issue_id: uuid, body: z.string().min(1).max(20000) },
    },
    async ({ issue_id, body }) => {
      const authorId = await currentUserId()
      if (!authorId) return failed('Could not read your user id from the sign-in. Sign in to Tikka again.')

      const { data, error } = await db
        .from('comments')
        .insert({ issue_id, author_id: authorId, body })
        .select('id, issue_id, body, created_at')
        .single()
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'link_issues',
    {
      description: 'Link two issues: one blocks the other, or the two relate.',
      inputSchema: {
        source_issue_id: uuid,
        target_issue_id: uuid,
        link_type: linkType,
      },
    },
    async ({ source_issue_id, target_issue_id, link_type }) => {
      const createdBy = await currentUserId()
      const { data, error } = await db
        .from('issue_links')
        .insert({ source_issue_id, target_issue_id, link_type, created_by: createdBy })
        .select('id, link_type, source_issue_id, target_issue_id')
        .single()
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'watch_issue',
    {
      description: 'Start getting updates on an issue.',
      inputSchema: { issue_id: uuid },
    },
    async ({ issue_id }) => {
      const userId = await currentUserId()
      if (!userId) return failed('Could not read your user id from the sign-in. Sign in to Tikka again.')

      const { error } = await db.from('watchers').insert({ issue_id, user_id: userId })
      return error ? failed(error.message) : text({ watching: issue_id })
    },
  )

  server.registerTool(
    'unwatch_issue',
    {
      description: 'Stop getting updates on an issue.',
      inputSchema: { issue_id: uuid },
    },
    async ({ issue_id }) => {
      const userId = await currentUserId()
      if (!userId) return failed('Could not read your user id from the sign-in. Sign in to Tikka again.')

      const { error } = await db.from('watchers').delete().eq('issue_id', issue_id).eq('user_id', userId)
      return error ? failed(error.message) : text({ watching: null })
    },
  )

  // Search, home and invites

  server.registerTool(
    'search',
    {
      description: 'Search issues in a workspace by text. Only issues you can see are returned.',
      inputSchema: { workspace_id: uuid, query: z.string().min(1).max(200) },
    },
    async ({ workspace_id, query }) => {
      const { data, error } = await db.rpc('search', { p_workspace: workspace_id, p_query: query })
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'my_work',
    {
      description: 'Show your work in a workspace: issues assigned to you, recently viewed issues and similar home-page items.',
      inputSchema: { workspace_id: uuid },
    },
    async ({ workspace_id }) => {
      const { data, error } = await db.rpc('home', { p_workspace: workspace_id })
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'create_invite',
    {
      description: 'Invite someone to a workspace (or to one invite-only project). Needs workspace owner or admin rights.',
      inputSchema: {
        workspace_id: uuid,
        email: z.email(),
        role: inviteRole,
        project_id: uuid.optional(),
      },
    },
    async ({ workspace_id, email, role, project_id }) => {
      const { data, error } = await db.rpc('create_invite', {
        p_workspace: workspace_id,
        p_email: email,
        p_role: role,
        p_project: project_id ?? null,
      })
      return error ? failed(error.message) : text(data)
    },
  )

  server.registerTool(
    'revoke_invite',
    {
      description: 'Revoke a pending invite.',
      inputSchema: { invite_id: uuid },
    },
    async ({ invite_id }) => {
      const { error } = await db.rpc('revoke_invite', { p_invite: invite_id })
      return error ? failed(error.message) : text({ revoked: invite_id })
    },
  )

  server.registerTool(
    'list_projects',
    {
      description: 'List the Tikka projects you can see, with their keys, names and templates (scrum or kanban).',
      inputSchema: { includeArchived: z.boolean().optional().describe('Also list archived projects. Defaults to false.') },
    },
    async ({ includeArchived }) => {
      let query = db.from('projects').select('id, key, name, template, archived_at').order('name')
      if (!includeArchived) query = query.is('archived_at', null)

      const { data, error } = await query
      return error ? failed(error.message) : text(data ?? [])
    },
  )

  return server
}

async function handle(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) {
    // The WWW-Authenticate header tells OAuth clients where to find the sign-in details, so they can start the
    // browser sign-in on their own.
    const origin = new URL(request.url).origin
    return new Response(JSON.stringify({ error: 'Sign in to Tikka to connect this app.' }), {
      status: 401,
      headers: {
        'content-type': 'application/json',
        'www-authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      },
    })
  }

  const server = buildServer(token)
  // Stateless: every request is self-contained, so any server instance can answer it.
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  return transport.handleRequest(request)
}

export async function POST(request: Request) {
  return handle(request)
}

export async function GET(request: Request) {
  return handle(request)
}

export async function DELETE(request: Request) {
  return handle(request)
}
