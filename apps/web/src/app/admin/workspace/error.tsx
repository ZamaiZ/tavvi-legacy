'use client'

import { RouteErrorState } from '@/components/shell/route-error-state'

export default function WorkspaceError({ retry }: { retry: () => void }) {
  return <RouteErrorState retry={retry} />
}
