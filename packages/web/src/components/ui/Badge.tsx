import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "teal" | "pink";
  className?: string;
}

const variantStyles = {
  default: "bg-gray-100 text-gray-600",
  primary: "bg-blueLight-1 text-brand-blue",
  success: "bg-green-100 text-statusGood",
  warning: "bg-yellow-100 text-yellow-600",
  danger: "bg-brand-red text-white",
  teal: "bg-teal-100 text-teal-600",
  pink: "bg-pink-100 text-pink-600",
};

export default function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
