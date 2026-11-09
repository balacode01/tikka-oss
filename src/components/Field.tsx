import type { InputHTMLAttributes, ReactNode } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: ReactNode
}

// Label above the control, and an error line under it that says what to do.
export function Field({ label, error, hint, id, className = '', ...rest }: Props) {
  const errorId = id ? `${id}-error` : undefined

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium text-sm text-text-primary">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && errorId ? errorId : undefined}
        className={[
          'h-8 w-full rounded-sm border bg-surface-raised px-3 text-sm text-text-primary placeholder:text-text-secondary',
          error ? 'border-danger' : 'border-border-strong',
          className,
        ].join(' ')}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="text-xs text-danger-text">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-text-secondary">{hint}</p>
      )}
    </div>
  )
}
