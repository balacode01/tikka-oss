import { useState } from 'react'
import { useSession } from '../../app/session-context'
import { CreateIssueDialog } from './CreateIssueDialog'
import { useBoard, useProjectSprints, useWorkspaceMembers } from './useBoard'

type Props = {
  workspaceSlug: string
  projects: { key: string; name: string }[]
  initialProjectKey: string
  onClose: () => void
}

// Create issue from the top bar. It loads the chosen project's statuses, sprints, epics and members,
// so the form matches the project picked in it. Switching project reloads those lists.
export function GlobalCreateIssue({ workspaceSlug, projects, initialProjectKey, onClose }: Props) {
  const { session } = useSession()
  const [projectKey, setProjectKey] = useState(initialProjectKey)
  const board = useBoard(workspaceSlug, projectKey)
  const members = useWorkspaceMembers(board.data?.project.workspace_id)
  const sprints = useProjectSprints(board.data?.project.id)

  if (!board.data) return null

  const { project, statuses, issues } = board.data
  const epics = issues
    .filter((i) => i.type === 'epic')
    .map((i) => ({ id: i.id, key: i.key, title: i.title }))

  return (
    <CreateIssueDialog
      key={projectKey}
      open
      onOpenChange={(next) => { if (!next) onClose() }}
      projectId={project.id}
      workspaceSlug={workspaceSlug}
      projectKey={projectKey}
      currentUserId={session?.user.id}
      members={members.data ?? []}
      statuses={statuses}
      sprints={sprints.data ?? []}
      epics={epics}
      todoStatusId={statuses.find((s) => s.category === 'todo')?.id}
      projects={projects}
      onProjectChange={setProjectKey}
    />
  )
}
