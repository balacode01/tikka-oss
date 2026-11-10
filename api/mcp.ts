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

function buildServer(token: string) {
  const server = new McpServer({ name: 'tikka', version: '0.1.0' })

  server.registerTool(
    'list_projects',
    {
      description: 'List the Tikka projects you can see, with their keys, names and templates (scrum or kanban).',
      inputSchema: { includeArchived: z.boolean().optional().describe('Also list archived projects. Defaults to false.') },
    },
    async ({ includeArchived }) => {
      let query = userClient(token).from('projects').select('id, key, name, template, archived_at').order('name')
      if (!includeArchived) query = query.is('archived_at', null)

      const { data, error } = await query
      if (error) return { isError: true, content: [{ type: 'text' as const, text: error.message }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
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
