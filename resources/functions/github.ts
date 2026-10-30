import { fetchGitHubNotifications, fetchGitHubViewer, searchGitHubIssues, searchGitHubRepositories } from '@stacksjs/github'
import { keychain } from '@stacksjs/desktop/browser'
import type { Result } from './search'

const service = 'com.stacksjs.launchpad.github'
let credential = ''
export type GitHubView = 'repositories' | 'issues' | 'pulls' | 'assigned' | 'reviews' | 'notifications'
const options = (signal?: AbortSignal) => ({ ...(credential ? { token: credential } : { anonymous: true }), retry: false, signal: signal ?? AbortSignal.timeout(12000) })

export async function restoreGitHub() {
  credential = await keychain.get(service, 'token') || ''
  try { return credential ? await fetchGitHubViewer(options()) : null }
  catch (error) {
    credential = ''
    throw error
  }
}

export async function connectGitHub(token: string) {
  const value = token.trim()
  if (!value) throw new Error('Enter a GitHub personal access token.')
  const viewer = await fetchGitHubViewer({ token: value, retry: false, signal: AbortSignal.timeout(12000) })
  await keychain.set(service, 'token', value)
  credential = value
  return viewer
}

export async function disconnectGitHub() {
  await keychain.delete(service, 'token')
  credential = ''
}

const apiResource = /^\/repos\/([^/]+\/[^/]+)\/(issues|pulls|commits)\/([^/]+)$/

export function githubWebUrl(value: string, fallback: string): string {
  const url = new URL(value || fallback)
  if (url.hostname === 'api.github.com' && url.pathname.startsWith('/repos/')) {
    const match = apiResource.exec(url.pathname)
    // Releases, check suites and similar API resources have no matching web path.
    const web = match ? `/${match[1]}/${match[2] === 'pulls' ? 'pull' : match[2]}/${match[3]}` : null
    if (!web && !fallback) throw new Error('GitHub returned an unsupported destination.')
    return githubWebUrl(web ? `https://github.com${web}` : fallback, '')
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') throw new Error('GitHub returned an unsupported destination.')
  return url.href
}

interface NotificationLike { subject: { title: string }, repository: { full_name: string } }

/** Whitespace around the search text must not hide matches. */
export function filterNotifications<T extends NotificationLike>(items: readonly T[], query: string): T[] {
  const term = query.trim().toLocaleLowerCase()
  return items.filter(item => `${item.subject.title} ${item.repository.full_name}`.toLocaleLowerCase().includes(term))
}

/** GitHub's search syntax is space separated, so empty qualifiers must not leave gaps. */
export function issueSearchQuery(scope: string, personal: string, query: string): string {
  return [scope ? `repo:${scope}` : '', 'is:open', personal, query.trim()].filter(Boolean).join(' ')
}

export async function githubResults(view: GitHubView, query: string, repository: string, login = '', signal?: AbortSignal): Promise<Result[]> {
  const controller = new AbortController()
  const cancel = () => controller.abort(signal?.reason)
  const timeout = setTimeout(cancel, 12000)
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  try { return await loadGitHubResults(view, query, repository, login, controller.signal) }
  finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}

async function loadGitHubResults(view: GitHubView, query: string, repository: string, login: string, signal: AbortSignal): Promise<Result[]> {
  if (['assigned', 'reviews', 'notifications'].includes(view) && !credential) throw new Error('Connect GitHub in Settings to see your personal work and notifications.')
  if (['assigned', 'reviews'].includes(view) && !login) throw new Error('GitHub is still loading your account. Try again in a moment.')
  const scope = repository.trim()
  if (scope && !/^[\w.-]+\/[\w.-]+$/.test(scope)) throw new Error('Use owner/repository for the repository scope, or leave it empty.')
  if (view === 'repositories') {
    const data = await searchGitHubRepositories(query.trim() || scope || 'stars:>100', options(signal))
    return data.items.map(repo => ({ key: `github:repo:${repo.id}`, title: repo.full_name, subtitle: repo.description || `${repo.stargazers_count} stars`, kind: 'github', content: githubWebUrl(repo.html_url, '') }))
  }
  if (view === 'notifications') {
    const data = await fetchGitHubNotifications(options(signal))
    return filterNotifications(data, query).map(item => ({ key: `github:notification:${item.id}`, title: item.subject.title, subtitle: `${item.repository.full_name} · ${item.reason}`, kind: 'github', content: githubWebUrl(item.subject.url || '', item.repository.html_url) }))
  }
  const kind = view === 'pulls' || view === 'reviews' ? 'pr' : 'issue'
  const personal = view === 'assigned' ? `assignee:${login}` : view === 'reviews' ? `review-requested:${login}` : ''
  const data = await searchGitHubIssues(issueSearchQuery(scope, personal, query), kind, options(signal))
  return data.items.map(item => ({ key: `github:issue:${item.id}`, title: item.title, subtitle: `${kind === 'pr' ? 'Pull request' : 'Issue'} #${item.number} · ${item.state} · ${item.user.login}`, kind: 'github', content: githubWebUrl(item.html_url, '') }))
}
