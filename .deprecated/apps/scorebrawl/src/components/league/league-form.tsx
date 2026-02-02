"use client";
import AutoForm from "@/components/auto-form";
import { LoadingButton } from "@/components/loading-button";
import { UploadButton } from "@/components/uploadthing";
import { LeagueCreateDTO } from "@/dto";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/trpc/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const DEFAULT_LEAGUE_LOGO =
  "https://utfs.io/f/c5562abd-47aa-46de-b6a9-936b4cef1875_mascot.png";

type FormValues = {
  name: string;
};

export const LeagueForm = ({
  buttonTitle,
  league,
}: {
  buttonTitle: string;

  league?: { name: string; logoUrl: string };
}) => {
  const { toast } = useToast();
  const { push, refresh } = useRouter();
  const { mutate, isPending } = api.league.create.useMutation();
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [logo, setLogo] = useState<string>(DEFAULT_LEAGUE_LOGO);

  const onSubmit = (val: FormValues) => {
    mutate(
      { ...val, logoUrl: logo },
      {
        onSettled: (data) => {
          if (data) {
            push(`/leagues/${data?.slug}`);
            refresh();
          }
        },
        onError: (err) => {
          toast({
            title: "Error creating league",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="grid grid-rows-2 gap-8 sm:grid-cols-2">
      <AutoForm
        formSchema={LeagueCreateDTO.omit({ logoUrl: true })}
        values={league}
        onSubmit={onSubmit}
      >
        <LoadingButton loading={isPending} type="submit" disabled={uploadInProgress}>
          {buttonTitle}
        </LoadingButton>
      </AutoForm>
      <div className="flex h-full w-full flex-col items-center justify-start gap-4 sm:justify-end">
        <Image width={160} height={160} src={logo} alt="logo" priority />
        <UploadButton
          className="ut-button:h-10 ut-button:items-center ut-button:justify-center ut-button:rounded-md ut-button:bg-primary ut-button:px-4 ut-button:py-2 ut-button:text-sm ut-button:font-medium ut-button:text-primary-foreground ut-button:ring-offset-background ut-button:transition-colors ut-button:hover:bg-primary/90 ut-button:focus-visible:outline-none ut-button:focus-visible:ring-2 ut-button:focus-visible:ring-ring ut-button:focus-visible:ring-offset-2 ut-button:disabled:pointer-events-none ut-button:disabled:opacity-50"
          endpoint="leagueLogo"
          onUploadBegin={() => setUploadInProgress(true)}
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
            setUploadInProgress(false);
            const fileUrl = res?.[0]?.url;
            if (fileUrl) {
              setLogo(fileUrl);
            }
          }}
          onUploadError={(error: Error) => {
            setUploadInProgress(false);
            setUploadError(error.message);
          }}
        />
      </div>
    </div>
  );
};
