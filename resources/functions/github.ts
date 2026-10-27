import { fetchGitHubNotifications, fetchGitHubViewer, searchGitHubIssues, searchGitHubRepositories } from '@stacksjs/github'
import { keychain } from '@stacksjs/desktop/browser'
import type { Result } from './search'

const service = 'com.stacksjs.launchpad.github'
let credential = ''
export type GitHubView = 'repositories' | 'issues' | 'pulls' | 'assigned' | 'reviews' | 'notifications'
const options = () => ({ ...(credential ? { token: credential } : { anonymous: true }), retry: false, signal: AbortSignal.timeout(12000) })

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

export function githubWebUrl(value: string, fallback: string): string {
  const url = new URL(value || fallback)
  if (url.hostname === 'api.github.com' && url.pathname.startsWith('/repos/')) {
    url.hostname = 'github.com'
    url.pathname = url.pathname.replace('/repos/', '/').replace('/pulls/', '/pull/')
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') throw new Error('GitHub returned an unsupported destination.')
  return url.href
}

export async function githubResults(view: GitHubView, query: string, repository: string, login = ''): Promise<Result[]> {
  if (['assigned', 'reviews', 'notifications'].includes(view) && !credential) throw new Error('Connect GitHub in Settings to see your personal work and notifications.')
  const scope = repository.trim()
  if (scope && !/^[\w.-]+\/[\w.-]+$/.test(scope)) throw new Error('Use owner/repository for the repository scope, or leave it empty.')
  if (view === 'repositories') {
    const data = await searchGitHubRepositories(query.trim() || scope || 'stars:>100', options())
    return data.items.map(repo => ({ key: `github:repo:${repo.id}`, title: repo.full_name, subtitle: repo.description || `${repo.stargazers_count} stars`, kind: 'github', content: githubWebUrl(repo.html_url, '') }))
  }
  if (view === 'notifications') {
    const data = await fetchGitHubNotifications(options())
    const term = query.toLocaleLowerCase()
    return data.filter(item => `${item.subject.title} ${item.repository.full_name}`.toLocaleLowerCase().includes(term)).map(item => ({ key: `github:notification:${item.id}`, title: item.subject.title, subtitle: `${item.repository.full_name} · ${item.reason}`, kind: 'github', content: githubWebUrl(item.subject.url || '', item.repository.html_url) }))
  }
  const kind = view === 'pulls' || view === 'reviews' ? 'pr' : 'issue'
  const personal = view === 'assigned' ? `assignee:${login}` : view === 'reviews' ? `review-requested:${login}` : ''
  const data = await searchGitHubIssues(`${scope ? `repo:${scope}` : ''} is:open ${personal} ${query}`, kind, options())
  return data.items.map(item => ({ key: `github:issue:${item.id}`, title: item.title, subtitle: `${kind === 'pr' ? 'Pull request' : 'Issue'} #${item.number} · ${item.state} · ${item.user.login}`, kind: 'github', content: githubWebUrl(item.html_url, '') }))
}
