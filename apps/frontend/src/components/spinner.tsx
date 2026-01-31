import { Loader2 } from "lucide-react";

export const Spinner = ({ size }: { size?: string }) => (
  <Loader2 size={size} className="animate-spin" />
);
