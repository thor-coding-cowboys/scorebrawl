import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitialsFromString } from "@scorebrawl/utils/string";
import { type VariantProps, cva } from "class-variance-authority";

const avatarVariants = cva("", {
  variants: {
    size: {
      sm: "h-6 w-6",
      md: "h-8 w-8",
      xl: "h-32 w-32",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

export type AvatarVariantProp = VariantProps<typeof avatarVariants>;

export const AvatarWithFallback = ({
  image,
  name,
  size,
  className,
}: { image?: string; name: string } & AvatarVariantProp & React.HTMLAttributes<HTMLDivElement>) => (
  <Avatar className={cn(className, avatarVariants({ size }))}>
    <AvatarImage src={image} />
    <AvatarFallback>{getInitialsFromString(name)}</AvatarFallback>
  </Avatar>
);
