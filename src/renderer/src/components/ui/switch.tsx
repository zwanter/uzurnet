import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@renderer/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 items-center rounded-full border transition-all duration-300 outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:border-white/20 data-[state=unchecked]:bg-white/10 hover:data-[state=unchecked]:border-white/40 hover:data-[state=unchecked]:bg-white/15",
        "data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 hover:data-[state=checked]:bg-emerald-400 hover:data-[state=checked]:border-emerald-400 data-[state=checked]:shadow-[0_0_14px_rgba(16,185,129,0.35)]",
        "focus-visible:ring-2 focus-visible:ring-emerald-500/50",
        "data-[size=default]:h-[22px] data-[size=default]:w-[44px] data-[size=sm]:h-4 data-[size=sm]:w-8",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full ring-0 shadow-sm transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          "data-[state=unchecked]:bg-white/80 group-hover/switch:data-[state=unchecked]:bg-white",
          "data-[state=checked]:bg-white data-[state=checked]:shadow-[0_1px_4px_rgba(0,0,0,0.35)]",
          "group-data-[size=default]/switch:size-3.5 group-data-[size=sm]/switch:size-2",
          "data-[state=unchecked]:translate-x-[3px] data-[state=checked]:translate-x-[23px]",
          "group-active/switch:w-4.5"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
