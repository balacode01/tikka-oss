import { Bookmark, Bug, CornerDownRight, SignalHigh, SignalLow, SignalMedium, SquareCheck, Zap, type LucideIcon } from 'lucide-react'
import type { BoardIssue } from './useBoard'

// Icons and colours from the design README: type icons in their type colour, priority as signal bars.
export const TYPE_ICON: Record<BoardIssue['type'], { icon: LucideIcon; color: string; label: string }> = {
  epic: { icon: Zap, color: 'text-type-epic', label: 'Epic' },
  story: { icon: Bookmark, color: 'text-type-story', label: 'Story' },
  task: { icon: SquareCheck, color: 'text-type-task', label: 'Task' },
  bug: { icon: Bug, color: 'text-type-bug', label: 'Bug' },
  subtask: { icon: CornerDownRight, color: 'text-type-subtask', label: 'Sub-task' },
}

export const PRIORITY_ICON: Record<Exclude<BoardIssue['priority'], 'urgent'>, { icon: LucideIcon; label: string }> = {
  high: { icon: SignalHigh, label: 'High' },
  medium: { icon: SignalMedium, label: 'Medium' },
  low: { icon: SignalLow, label: 'Low' },
}
