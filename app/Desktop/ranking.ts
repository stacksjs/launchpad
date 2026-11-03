import LaunchRecord from '../Models/LaunchRecord'

/** Apply intent against the latest model row, rather than a WebView's cached ID/count. */
export function createRankingApi(modelApi: (request: Request) => Promise<Response | null>) {
  let pending: Promise<unknown> = Promise.resolve()
  return async (request: Request): Promise<Response | null> => {
    if (new URL(request.url).pathname !== '/api/ranking' || request.method !== 'POST') return null
    const apply = async () => {
      let body
      try { body = await request.json() }
      catch { return Response.json({ error: 'Invalid ranking request.' }, { status: 400 }) }
      if (!body || typeof body.key !== 'string' || !['launch', 'favorite', 'aliases'].includes(body.action) || (body.action === 'aliases' && typeof body.aliases !== 'string'))
        return Response.json({ error: 'Invalid ranking request.' }, { status: 422 })
      const row = await LaunchRecord.where('key', body.key).first()
      const changes = body.action === 'launch' ? { launches: Number(row?.launches || 0) + 1, lastUsed: Date.now() }
        : body.action === 'favorite' ? { favorite: !row?.favorite } : { aliases: body.aliases }
      // The generated API remains responsible for validation, defaults and persistence.
      return modelApi(new Request(new URL(`/api/launch-records${row ? `/${row.id}` : ''}`, request.url), {
        method: row ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: body.key, ...changes }),
      }))
    }
    const result = pending.then(apply)
    pending = result.catch(() => {})
    return result
  }
}
