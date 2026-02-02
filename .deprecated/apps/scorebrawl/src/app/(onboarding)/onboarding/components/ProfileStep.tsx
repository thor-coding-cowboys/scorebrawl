"use client";
import { AvatarWithFallback } from "@/components/avatar/avatar-with-fallback";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadButton } from "@/components/uploadthing";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/trpc/react";
import { getInitialsFromString } from "@scorebrawl/utils/string";
import { useCallback, useEffect, useRef, useState } from "react";

export const ProfileStep = () => {
  const { data: user } = api.user.me.useQuery();
  const { mutate: updateUser } = api.user.update.useMutation();
  const { user: userUtils } = api.useUtils();

  const [name, setName] = useState(user?.name ?? "");
  const [uploadError, setUploadError] = useState<string | undefined>();

  const timerRef = useRef<null | Timer>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
    }
  }, [user]);

  const debouncedUpdate = useCallback(
    ({ name }: { name: string }) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(async () => {
        updateUser(
          { name },
          {
            onSuccess: () => {
              toast({ title: "Profile updated" });
              userUtils.me.invalidate();
            },
          },
        );
      }, 300);
    },
    [updateUser, toast, userUtils.me],
  );

  return (
    <>
      <CardHeader>
        <CardTitle>Who are you?</CardTitle>
        <CardDescription>Customize your profile</CardDescription>
      </CardHeader>
      <CardContent className={"flex flex-col items-center gap-3"}>
        <AvatarWithFallback size="xl" image={user?.image} name={getInitialsFromString(name)} />
        <UploadButton
          className="ut-button:h-10 ut-button:items-center ut-button:justify-center ut-button:rounded-md ut-button:bg-primary ut-button:px-4 ut-button:py-2 ut-button:text-sm ut-button:font-medium ut-button:text-primary-foreground ut-button:ring-offset-background ut-button:transition-colors ut-button:hover:bg-primary/90 ut-button:focus-visible:outline-none ut-button:focus-visible:ring-2 ut-button:focus-visible:ring-ring ut-button:focus-visible:ring-offset-2 ut-button:disabled:pointer-events-none ut-button:disabled:opacity-50"
          endpoint="profileAvatar"
          onUploadBegin={() => {}}
          onUploadProgress={() => {
            setUploadError(undefined);
          }}
          content={{
            allowedContent: ({
              isUploading,
              uploadProgress,
            }: {
              isUploading: boolean;
              uploadProgress: number;
            }) => {
              if (uploadError) {
                return <p className="text-destructive">{uploadError}</p>;
              }
              return isUploading ? (
                <p>{`Uploading ${uploadProgress}%...`}</p>
              ) : (
                <p>Square images recommended (Max 4MB)</p>
              );
            },
          }}
          onClientUploadComplete={(res: { url: string }[]) => {
            const fileUrl = res?.[0]?.url;
            if (fileUrl) {
              updateUser(
                { image: fileUrl },
                {
                  onSuccess: () => {
                    userUtils.me.invalidate();
                    toast({ title: "Profile picture updated" });
                  },
                },
              );
            }
          }}
          onUploadError={(error: Error) => {
            setUploadError(error.message);
          }}
        />
        <div className="w-full max-w-sm md:max-w-2xl xl:max-w-4xl mx-auto">
          <div className="flex flex-col">
            <div className="flex-1">
              <Label htmlFor="name">Name</Label>
              <Input
                type="text"
                id="name"
                value={name}
                onChange={(e) => {
                  const updatedName = e.target.value;
                  setName(updatedName);
                  debouncedUpdate({ name: updatedName });
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </>
  );
};
