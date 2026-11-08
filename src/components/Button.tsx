import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'outline' | 'ghost'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  fullWidth?: boolean
}

// One filled primary button per view. Everything else is outlined (BRD §7.4).
const variants: Record<Variant, string> = {
  primary:
    'border-primary bg-primary text-on-primary hover:bg-primary-hover hover:border-primary-hover',
  outline:
    'border-border-strong bg-surface-raised text-text-primary hover:bg-surface-hover',
  ghost: 'border-transparent bg-transparent text-text-primary hover:bg-surface-hover',
}

export function Button({ variant = 'outline', fullWidth, className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={[
        'inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-sm border px-3 font-medium text-sm',
        variants[variant],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    />
  )
}
