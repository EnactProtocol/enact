import { Loader2 } from "lucide-react";

interface SpinnerProps {
  className?: string;
  size?: number;
}

export default function Spinner({ className = "", size = 24 }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 className="animate-spin text-brand-blue" size={size} />
    </div>
  );
}
