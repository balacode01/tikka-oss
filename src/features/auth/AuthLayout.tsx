import type { ReactNode } from 'react'

// Two-column layout from the sign-up artboard. The brand panel hides on narrow screens.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap bg-surface-page text-text-primary">
      <main className="flex w-full flex-col justify-center px-4 py-8 md:w-[560px] md:px-20 md:py-12">
        <div className="mx-auto flex w-full max-w-[400px] flex-col gap-6">
          <p className="font-semibold text-xl text-text-primary md:hidden">Tikka</p>
          {children}
        </div>
      </main>

      <aside
        aria-label="Tikka"
        className="hidden flex-1 flex-col justify-center gap-10 bg-surface-selected p-16 md:flex"
      >
        <div className="flex max-w-[520px] flex-col gap-3">
          <p className="font-semibold text-6xl text-text-primary">Tikka</p>
          <p className="text-xl text-primary-subtle-text">Plan, track and ship work with your team.</p>
        </div>
      </aside>
    </div>
  )
}
