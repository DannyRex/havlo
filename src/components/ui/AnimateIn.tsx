"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Variant = "fade-up" | "fade-in" | "slide-left" | "slide-right" | "scale-in";

interface Props {
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
  delay?: number;
  threshold?: number;
  as?: React.ElementType;
}

export default function AnimateIn({
  children,
  className,
  variant = "fade-up",
  delay = 0,
  threshold = 0.12,
  as: Tag = "div",
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const hidden: Record<Variant, string> = {
    "fade-up":    "translate-y-8 opacity-0",
    "fade-in":    "opacity-0",
    "slide-left": "-translate-x-10 opacity-0",
    "slide-right":"translate-x-10 opacity-0",
    "scale-in":   "scale-95 opacity-0",
  };

  return (
    <Tag
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        visible
          ? "translate-y-0 translate-x-0 scale-100 opacity-100"
          : hidden[variant],
        className
      )}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}
