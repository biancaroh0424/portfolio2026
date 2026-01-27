import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'filled' | 'lined' | 'ghost' | 'iconOnly'
type ButtonStatus = 'default' | 'hovered' | 'disabled'
type IconPosition = 'left' | 'right' | 'center'
type LoaderPosition = 'left' | 'right'

type ButtonProps = {
  variant?: ButtonVariant
  status?: ButtonStatus
  icon?: ReactNode
  iconPosition?: IconPosition
  isLoading?: boolean
  loaderPosition?: LoaderPosition
  className?: string
  children?: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled'>

const spinner = (
  <svg
    viewBox="0 0 16 16"
    className="h-4 w-4"
    role="img"
    aria-hidden="true"
  >
    <circle
      cx="8"
      cy="8"
      r="6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="24"
      strokeDashoffset="18"
    >
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 8 8"
        to="360 8 8"
        dur="0.9s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
)

const getStatusClasses = (variant: ButtonVariant, status: ButtonStatus) => {
  if (variant === 'iconOnly') {
    if (status === 'hovered') return 'bg-fillwhite-20 text-white'
    if (status === 'disabled') return 'text-greyscale-300'
    return 'text-white'
  }

  if (variant === 'filled') {
    if (status === 'hovered') return 'bg-greyscale-100 text-greyscale-700'
    if (status === 'disabled') return 'bg-greyscale-200 text-greyscale-300'
    return 'bg-greyscale-white text-greyscale-700'
  }

  if (variant === 'lined') {
    if (status === 'hovered') return 'border border-greyscale-100 text-greyscale-100'
    if (status === 'disabled') return 'border border-greyscale-200 text-greyscale-300'
    return 'border border-greyscale-white text-greyscale-white'
  }

  if (status === 'hovered') return 'text-greyscale-100'
  if (status === 'disabled') return 'text-greyscale-300'
  return 'text-greyscale-white'
}

const getLayoutClasses = (
  variant: ButtonVariant,
  iconPosition?: IconPosition,
  hasIcon?: boolean,
  hasLoader?: boolean
) => {
  if (variant === 'iconOnly') {
    return iconPosition === 'center'
      ? 'p-1 rounded-[16px]'
      : 'p-1 rounded-[16px]'
  }

  const hasStartAdornment = (hasIcon && iconPosition === 'left') || hasLoader
  const hasEndAdornment = hasIcon && iconPosition === 'right'

  if (hasStartAdornment && !hasEndAdornment) {
    return 'gap-2 pl-[10px] pr-[12px] py-[12px] rounded-[24px]'
  }

  if (!hasStartAdornment && hasEndAdornment) {
    return 'gap-2 pl-[12px] pr-[10px] py-[12px] rounded-[24px]'
  }

  return 'gap-2 px-[16px] py-[12px] rounded-[24px]'
}

export default function Button({
  variant = 'filled',
  status = 'default',
  icon,
  iconPosition = 'left',
  isLoading = false,
  loaderPosition = 'left',
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const disabled = status === 'disabled' || rest.disabled
  const resolvedStatus = disabled ? 'disabled' : status
  const hasIcon = Boolean(icon)
  const hasLoader = isLoading

  const layoutClasses = getLayoutClasses(variant, iconPosition, hasIcon, hasLoader)
  const statusClasses = getStatusClasses(variant, resolvedStatus)
  const baseClasses = 'inline-flex items-center justify-center text-button'

  const iconNode = hasIcon ? <span className="flex h-4 w-4 items-center justify-center">{icon}</span> : null
  const loaderNode = hasLoader ? <span className="flex h-4 w-4 items-center justify-center">{spinner}</span> : null

  return (
    <button
      type="button"
      className={`${baseClasses} ${layoutClasses} ${statusClasses} ${className || ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-busy={isLoading}
      {...rest}
    >
      {variant === 'iconOnly' ? (
        <span className="flex h-4 w-4 items-center justify-center">
          {hasLoader ? spinner : icon}
        </span>
      ) : (
        <>
          {loaderPosition === 'left' ? loaderNode : null}
          {iconPosition === 'left' && !isLoading ? iconNode : null}
          {children && <span>{children}</span>}
          {iconPosition === 'right' && !isLoading ? iconNode : null}
          {loaderPosition === 'right' ? loaderNode : null}
        </>
      )}
    </button>
  )
}
