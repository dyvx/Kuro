"use client";

import { useCallback, useState } from "react";

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const update = useCallback(
    (v: T) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* non-fatal */
      }
    },
    [key]
  );
  return [value, update];
}

export function useOnScreen<T extends HTMLElement>(rootMargin = "400px") {
  const [visible, setVisible] = useState(false);
  const [node, setNode] = useState<T | null>(null);
  const [fired, setFired] = useState(false);

  const ref = useCallback(
    (el: T | null) => setNode(el),
    []
  );

  // Re-observe when node changes.
  if (node && typeof IntersectionObserver !== "undefined" && !fired) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          setFired(true);
        }
      },
      { rootMargin }
    );
    observer.observe(node);
  }

  return { ref, visible };
}
