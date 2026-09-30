/**
 * Verifies the caller's Supabase session before we spend Anthropic tokens.
 * Without this, the endpoint is an open proxy to a paid API.
 */
export async function verifySupabaseUser(
  authorization: string | undefined,
): Promise<{ userId: string } | null> {
  const token = authorization?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Server is missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  }

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null

  const user = (await response.json()) as { id?: string }
  return user.id ? { userId: user.id } : null
}
