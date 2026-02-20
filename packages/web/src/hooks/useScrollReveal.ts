import { useCallback, useEffect, useRef } from "react";

type AnimationVariant = "fade-up" | "fade-down" | "fade-left" | "fade-right" | "zoom-in" | "fade";

interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

/**
 * A hook that returns a ref callback to attach to elements you want to animate on scroll.
 * Uses IntersectionObserver for performant scroll-triggered animations.
 *
 * Usage:
 *   const reveal = useScrollReveal();
 *   <div ref={reveal("fade-up", 100)}>...</div>
 */
export function useScrollReveal(options: ScrollRevealOptions = {}) {
  const { threshold = 0.15, rootMargin = "0px 0px -40px 0px", once = true } = options;
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef<Set<Element>>(new Set());

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("scroll-revealed");
            if (once) {
              observerRef.current?.unobserve(entry.target);
            }
          } else if (!once) {
            entry.target.classList.remove("scroll-revealed");
          }
        }
      },
      { threshold, rootMargin }
    );

    // Observe any elements that were registered before the observer was ready
    for (const el of elementsRef.current) {
      observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [threshold, rootMargin, once]);

  const reveal = useCallback((variant: AnimationVariant = "fade-up", delayMs = 0) => {
    return (el: HTMLElement | null) => {
      if (!el) return;
      el.classList.add("scroll-reveal", `scroll-reveal-${variant}`);
      if (delayMs > 0) {
        el.style.transitionDelay = `${delayMs}ms`;
      }
      elementsRef.current.add(el);
      observerRef.current?.observe(el);
    };
  }, []);

  return reveal;
}
