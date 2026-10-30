import { appleScriptString, cleanField, parseRecords } from './applescript'
import type { Result } from './search'

export interface ContactEntry { id: string, name: string, email: string, phone: string, organization: string }

/** Contact identifiers look like 3F2A…:ABPerson. Anything else is refused before it reaches a script. */
export const contactId = /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,100}$/

export const maxContacts = 25

/** Looks people up by name or company inside Contacts. Matches stay in memory and are never stored by Launchpad. */
export function contactSearchScript(query: string): string {
  const q = appleScriptString(query.trim().slice(0, 80))
  return `set output to ""
tell application "Contacts"
  set found to (every person whose name contains ${q} or organization contains ${q})
  set total to count of found
  if total > ${maxContacts} then set total to ${maxContacts}
  repeat with i from 1 to total
    set p to item i of found
    set e to ""
    set n to ""
    set o to ""
    try
      set e to value of first email of p
    end try
    try
      set n to value of first phone of p
    end try
    try
      set o to organization of p
    end try
    if o is missing value then set o to ""
    set output to output & (id of p) & tab & (name of p) & tab & e & tab & n & tab & o & linefeed
  end repeat
end tell
return output`
}

export function parseContacts(output: string): ContactEntry[] {
  return parseRecords(output, 5).flatMap(([id, name, email, phone, organization]) => {
    const entry = { id: cleanField(id), name: cleanField(name), email: cleanField(email), phone: cleanField(phone), organization: cleanField(organization) }
    return contactId.test(entry.id) && entry.name ? [entry] : []
  })
}

export function contactResults(entries: readonly ContactEntry[]): Result[] {
  return entries.map(entry => ({
    key: `contact:${entry.id}`, title: entry.name, subtitle: ['Contact', entry.organization, entry.email, entry.phone].filter(Boolean).join(' · '),
    kind: 'contact', content: entry.id, searchText: [entry.email, entry.phone, entry.organization].join(' '),
  }))
}

/** The detail Copy takes: an email address first, then a phone number. */
export function contactDetail(entry: Pick<ContactEntry, 'email' | 'phone'>): string {
  return entry.email || entry.phone
}

/** Reveal a person in Contacts. Null when the identifier is not one Contacts could have produced. */
export function contactOpenScript(id: string): string | null {
  if (!contactId.test(id)) return null
  return `tell application "Contacts"
  activate
  set selection to {person id ${appleScriptString(id)}}
end tell`
}
