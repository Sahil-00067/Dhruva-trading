import type { ReactNode } from 'react'
import { TopNav } from './TopNav'
import { BottomNav } from './BottomNav'
import { Disclaimer } from './Disclaimer'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="brand-bar" />
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 sm:pt-8">
        {children}
        <footer className="mt-10 border-t border-paper-3 pt-5">
          <Disclaimer compact />
        </footer>
      </main>
      <BottomNav />
    </div>
  )
}
