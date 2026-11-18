import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary: "bg-electric-600 text-white hover:bg-electric-500 active:bg-electric-600",
        secondary: "bg-navy-900 text-white hover:bg-navy-700",
        outline: "border border-mist-300 bg-white text-navy-900 hover:bg-mist-50",
        "outline-dark": "border border-white/30 text-white hover:bg-white/10",
        ghost: "text-navy-900 hover:bg-mist-100",
      },
      size: { sm: "h-9 px-3.5 text-sm", md: "h-11 px-5 text-[0.95rem]", lg: "h-12 px-6 text-base" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
type Variants = VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & Variants>(
  ({ className, variant, size, type = "button", ...props }, ref) => <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />,
);
Button.displayName = "Button";

/** Navigation button. `href` is required, which makes dead "#" buttons a type error. */
export function ButtonLink({ href, className, variant, size, ...props }: React.ComponentProps<typeof Link> & Variants) {
  if (!href || href === "#") throw new Error("ButtonLink requires a real destination");
  return <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
