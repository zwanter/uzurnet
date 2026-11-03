import React, { useEffect, useRef } from 'react'
import { useTrafficStore } from '@renderer/store/traffic-store'

interface KineticWaveProps {
  active?: boolean
  className?: string
}

export const KineticWave: React.FC<KineticWaveProps> = ({ active = true, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const traffic = useTrafficStore((s) => s.traffic)
  const trafficRef = useRef(traffic)

  useEffect(() => {
    trafficRef.current = traffic
  }, [traffic])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let step = 0

    const resize = (): void => {
      if (!canvas.parentElement) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.parentElement.clientWidth * dpr
      canvas.height = canvas.parentElement.clientHeight * dpr
      ctx.resetTransform()
      ctx.scale(dpr, dpr)
    }

    resize()
    window.addEventListener('resize', resize)

    // Particles array
    const particles = Array.from({ length: 12 }, () => ({
      x: Math.random() * 800,
      y: Math.random() * 60,
      radius: Math.random() * 1.8 + 1,
      speedX: Math.random() * 1.2 + 0.6,
      opacity: Math.random() * 0.7 + 0.3
    }))

    let currentSpeed = 30
    let targetSpeed = 30

    const render = (): void => {
      const parent = canvas.parentElement
      if (!parent) return

      const w = parent.clientWidth
      const h = parent.clientHeight
      ctx.clearRect(0, 0, w, h)

      step += 0.04

      // Calculate speed based on live traffic store (in MB/s)
      const liveBytes = trafficRef.current.down || 0
      const liveMB = liveBytes / (1024 * 1024)
      if (active) {
        targetSpeed = Math.max(15, Math.min(85, liveMB > 0 ? liveMB * 4 + 20 : 35 + Math.sin(step * 0.8) * 12))
      } else {
        targetSpeed = 4
      }
      currentSpeed += (targetSpeed - currentSpeed) * 0.06

      // Layer 1: Background Soft Glow Wave (Cyan / Emerald Glow)
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let x = 0; x <= w; x += 10) {
        const y = h - 18 - Math.sin(x * 0.015 + step * 0.8) * 12 - Math.cos(x * 0.03 - step * 0.5) * 6
        ctx.lineTo(x, y)
      }
      ctx.lineTo(w, h)
      ctx.closePath()
      const gradBg = ctx.createLinearGradient(0, 0, 0, h)
      gradBg.addColorStop(0, 'rgba(6, 182, 212, 0.15)')
      gradBg.addColorStop(1, 'rgba(6, 182, 212, 0.0)')
      ctx.fillStyle = gradBg
      ctx.fill()

      // Layer 2: Main Kinetic Wave Area Fill (Emerald)
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let x = 0; x <= w; x += 8) {
        const waveNormal = Math.sin(x * 0.02 + step) * 14 + Math.cos(x * 0.012 + step * 0.7) * 9
        const y = h - (currentSpeed / 90) * (h * 0.65) - waveNormal
        ctx.lineTo(x, y)
      }
      ctx.lineTo(w, h)
      ctx.closePath()
      const gradMain = ctx.createLinearGradient(0, 0, 0, h)
      gradMain.addColorStop(0, active ? 'rgba(16, 185, 129, 0.32)' : 'rgba(255, 255, 255, 0.06)')
      gradMain.addColorStop(1, 'rgba(16, 185, 129, 0.0)')
      ctx.fillStyle = gradMain
      ctx.fill()

      // Layer 3: Neon Emerald Crest Line
      ctx.beginPath()
      for (let x = 0; x <= w; x += 8) {
        const waveNormal = Math.sin(x * 0.02 + step) * 14 + Math.cos(x * 0.012 + step * 0.7) * 9
        const y = h - (currentSpeed / 90) * (h * 0.65) - waveNormal
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = active ? '#10b981' : 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 2
      ctx.shadowColor = active ? '#10b981' : 'transparent'
      ctx.shadowBlur = active ? 8 : 0
      ctx.stroke()
      ctx.shadowBlur = 0

      // Flowing particles
      if (active) {
        particles.forEach((p) => {
          p.x += p.speedX
          if (p.x > w) p.x = 0
          ctx.beginPath()
          const pY = p.y + Math.sin(p.x * 0.05 + step) * 4
          ctx.arc(p.x, pY, p.radius, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(52, 211, 153, ${p.opacity})`
          ctx.fill()
        })
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)
    }
  }, [active])

  return (
    <div className={`relative w-full h-24 overflow-hidden rounded-lg bg-black/20 border border-white/5 ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  )
}

export default KineticWave
