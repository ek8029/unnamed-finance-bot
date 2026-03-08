'use client'

import { useEffect, useState, useRef } from 'react'

interface UseAnimatedCounterOptions {
  duration?: number
  delay?: number
  easing?: (t: number) => number
}

// Easing functions
const easeOutExpo = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

export function useAnimatedCounter(
  end: number,
  options: UseAnimatedCounterOptions = {}
): number {
  const { duration = 1200, delay = 0, easing = easeOutExpo } = options
  const [count, setCount] = useState(0)
  const frameRef = useRef<number | undefined>(undefined)
  const startTimeRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const startTime = performance.now() + delay
    startTimeRef.current = startTime

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) return

      const elapsed = currentTime - startTimeRef.current

      if (elapsed < 0) {
        frameRef.current = requestAnimationFrame(animate)
        return
      }

      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easing(progress)
      const currentCount = Math.floor(easedProgress * end)

      setCount(currentCount)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        setCount(end)
      }
    }

    frameRef.current = requestAnimationFrame(animate)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [end, duration, delay, easing])

  return count
}
