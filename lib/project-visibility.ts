export type ProjectVisibility = 'public' | 'private'

/** Documents created before visibility was introduced keep their public status. */
export function isPublicProject(project: { visibility?: unknown }): boolean {
  return project.visibility === undefined || project.visibility === 'public'
}

export function visibleProjects<T extends { visibility?: unknown }>(projects: T[], isAdmin = false): T[] {
  return isAdmin ? projects : projects.filter(isPublicProject)
}

/** Recheck the current CMS state, including when an old search index is still in use. */
export function publicSearchResults<T extends { content: { type: string; projectId?: string } }>(
  results: T[], projects: Array<{ id: string; visibility?: unknown }>
): T[] {
  const allowed = new Set(projects.filter(isPublicProject).map(project => project.id))
  return results.filter(({ content }) => content.projectId
    ? allowed.has(content.projectId)
    : content.type !== 'project')
}
