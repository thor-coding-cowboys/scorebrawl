import { Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";

type LoadingButtonProps = {
  loading?: boolean;
} & ButtonProps;

export function LoadingButton({ loading, children, ...props }: LoadingButtonProps) {
  return (
    <Button disabled={loading} {...props}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}
