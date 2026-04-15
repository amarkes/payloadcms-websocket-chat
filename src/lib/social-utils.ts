export function resolveRelationshipId(value: unknown): string | number | null {
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const relation = value as { id?: string | number | null }
    return relation.id ?? null
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  return null
}

export function normalizeRelationshipIds(value: unknown): Array<string | number> {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => resolveRelationshipId(entry))
    .filter((entry): entry is string | number => entry !== null)
}

export function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#(\w+)/g) ?? []
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))]
}
