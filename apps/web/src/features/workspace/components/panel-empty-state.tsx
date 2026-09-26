import type { ReactNode } from 'react'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

type PanelEmptyStateProps = {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  density?: 'page' | 'section' | 'compact'
}

export function PanelEmptyState({
  icon,
  title,
  description,
  action,
  density = 'section',
}: PanelEmptyStateProps) {
  return (
    <Empty className="tv-panel-empty" data-density={density}>
      <EmptyHeader className="tv-panel-empty-header">
        <EmptyMedia variant="icon" className="tv-panel-empty-icon" aria-hidden="true">
          {icon}
        </EmptyMedia>
        <EmptyTitle className="tv-panel-empty-title" role="heading" aria-level={2}>
          {title}
        </EmptyTitle>
        <EmptyDescription className="tv-panel-empty-description">
          {description}
        </EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent className="tv-panel-empty-content">{action}</EmptyContent> : null}
    </Empty>
  )
}
