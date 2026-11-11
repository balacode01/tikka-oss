/// <reference types="node" />

// OAuth protected resource metadata (RFC 9728). Tells OAuth clients such as Claude which server issues the
// tokens for Tikka's MCP endpoint: the Supabase project's own auth server.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin
  return new Response(
    JSON.stringify({
      resource: `${origin}/api/mcp`,
      authorization_servers: [`${process.env.VITE_SUPABASE_URL}/auth/v1`],
      bearer_methods_supported: ['header'],
    }),
    { headers: { 'content-type': 'application/json' } },
  )
}
