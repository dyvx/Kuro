"use client";

import { useState } from "react";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import { cn } from "@/utils/cn";

interface PosterProps {
  src?: string | null;
  alt: string;
  color?: string | null;
  sizes?: string;
  className?: string;
  priority?: boolean;
}

/**
 * Poster image with graceful gradient fallback when art is missing
 * or fails to load (keeps the layout beautiful, never a broken icon).
 */
export function Poster({ src, alt, color, sizes = "(max-width:640px) 45vw, 240px", className, priority }: PosterProps) {
  const [failed, setFailed] = useState(false);
  const gradient = color
    ? `linear-gradient(150deg, ${color}44 0%, #16162a 55%, #0a0a14 100%)`
    : "linear-gradient(150deg, rgba(139,92,246,0.25) 0%, #16162a 55%, #0a0a14 100%)";

  if (!src || failed) {
    return (
      <div
        className={cn("flex h-full w-full items-center justify-center", className)}
        style={{ background: gradient }}
        role="img"
        aria-label={alt}
      >
        <Clapperboard className="h-8 w-8 text-white/25" aria-hidden />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}
