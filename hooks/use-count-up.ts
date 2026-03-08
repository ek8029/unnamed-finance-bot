import { useEffect, useState, useRef } from 'react';

/**
 * Easing function for smooth count-up animation
 * Uses ease-out cubic easing
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Custom hook for animating number count-ups
 * @param end - Target value to count to
 * @param duration - Animation duration in milliseconds (default: 1000ms)
 * @param start - Starting value (default: 0)
 * @param delay - Delay before animation starts (default: 0ms)
 * @returns Current animated value
 */
export function useCountUp(
  end: number,
  duration: number = 1000,
  start: number = 0,
  delay: number = 0
): number {
  const [count, setCount] = useState(start);
  const frameRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Reset when end value changes
    setCount(start);

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp + delay;
      }

      const elapsed = timestamp - startTimeRef.current;

      if (elapsed < 0) {
        // Still in delay period
        frameRef.current = requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const currentCount = start + (end - start) * easedProgress;

      setCount(currentCount);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure we end exactly at the target value
        setCount(end);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      startTimeRef.current = undefined;
    };
  }, [end, duration, start, delay]);

  return count;
}
