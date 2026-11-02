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
        "peer group/switch inline-flex shrink-0 items-center rounded-full border transition-all duration-200 outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:border-white/50 data-[state=unchecked]:bg-transparent hover:data-[state=unchecked]:border-white/70 hover:data-[state=unchecked]:bg-white/[0.04]",
        "data-[state=checked]:border-[#0078D4] data-[state=checked]:bg-[#0078D4] hover:data-[state=checked]:bg-[#1084d8] hover:data-[state=checked]:border-[#1084d8] active:data-[state=checked]:bg-[#006cbe]",
        "focus-visible:ring-2 focus-visible:ring-[#0078D4]/50",
        "data-[size=default]:h-[22px] data-[size=default]:w-[42px] data-[size=sm]:h-4 data-[size=sm]:w-8",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full ring-0 transition-transform duration-200 ease-out shadow-xs",
          "data-[state=unchecked]:bg-white/80 group-hover/switch:data-[state=unchecked]:bg-white",
          "data-[state=checked]:bg-white data-[state=checked]:shadow-[0_1px_3px_rgba(0,0,0,0.35)]",
          "group-data-[size=default]/switch:size-3 group-data-[size=sm]/switch:size-2",
          "data-[state=unchecked]:translate-x-[4px] data-[state=checked]:translate-x-[24px]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
