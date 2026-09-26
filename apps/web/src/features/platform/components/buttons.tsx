'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from 'cn'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }

export function PrimaryCTA({ className, children, ...props }: Props) {
  return <button className={cn('tv-primary-cta', className)} {...props}>{children}</button>
}

export function SecondaryCTA({ className, children, ...props }: Props) {
  return <button className={cn('tv-secondary-cta', className)} {...props}>{children}</button>
}

export function TonalButton({ className, children, ...props }: Props) {
  return <button className={cn('tv-tonal-button', className)} {...props}>{children}</button>
}

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('tv-icon-button', className)} {...props} />
}
