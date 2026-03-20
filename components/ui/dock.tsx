import * as React from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"

import { cn } from "../../lib/utils"

type DockDirection = "left" | "middle" | "right"

export type DockProps = {
  className?: string
  children: React.ReactNode
  iconSize?: number
  iconMagnification?: number
  iconDistance?: number
  direction?: DockDirection
  disableMagnification?: boolean
}

export const Dock = ({
  className,
  children,
  iconSize = 40,
  iconMagnification = 60,
  iconDistance = 140,
  direction = "middle",
  disableMagnification = false,
}: DockProps) => {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY)

  const resolved = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child

    // Only inject into DockIcon elements
    const type = child.type as any
    const isDockIcon = type?.displayName === "DockIcon"
    if (!isDockIcon) return child

    return React.cloneElement(child as any, {
      mouseX,
      size: iconSize,
      magnification: iconMagnification,
      distance: iconDistance,
      disableMagnification,
    })
  })

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
      className={cn(
        "flex items-end gap-2 rounded-2xl border border-border/50 bg-card/80 px-2 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/60",
        direction === "left" && "justify-start",
        direction === "middle" && "justify-center",
        direction === "right" && "justify-end",
        className
      )}
    >
      {resolved}
    </motion.div>
  )
}

export type DockIconProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: number
  magnification?: number
  distance?: number
  mouseX?: any
  disableMagnification?: boolean
}

type DockIconSafeProps = Omit<
  DockIconProps,
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
> & {
  onDrag?: never
  onDragStart?: never
  onDragEnd?: never
  onAnimationStart?: never
  onAnimationEnd?: never
  onAnimationIteration?: never
}

export const DockIcon = React.forwardRef<HTMLDivElement, DockIconSafeProps>(
  (
    {
      className,
      children,
      size = 40,
      magnification = 60,
      distance = 140,
      mouseX,
      disableMagnification = false,
      ...props
    },
    ref
  ) => {
    const innerRef = React.useRef<HTMLDivElement | null>(null)

    const setRefs = (node: HTMLDivElement | null) => {
      innerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    }

    const baseSize = useSpring(size, { stiffness: 300, damping: 30 })

    const width = useTransform(mouseX ?? baseSize, (x: number) => {
      if (disableMagnification) return size
      const el = innerRef.current
      if (!el || !Number.isFinite(x)) return size
      const rect = el.getBoundingClientRect()
      const center = rect.left + rect.width / 2
      const d = Math.abs(x - center)
      const t = Math.max(0, 1 - d / distance)
      return size + (magnification - size) * t
    })

    const height = width

    return (
      <motion.div
        ref={setRefs}
        style={{ width, height }}
        className={cn("flex items-center justify-center", className)}
        {...(props as any)}
      >
        {children}
      </motion.div>
    )
  }
)

DockIcon.displayName = "DockIcon"
