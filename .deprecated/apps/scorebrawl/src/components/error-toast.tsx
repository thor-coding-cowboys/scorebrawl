"use client";
import { clearLastVisitedLeague } from "@/actions/navigation-actions";
import { useToast } from "@/hooks/use-toast";
import { useQueryState } from "nuqs";
import { useEffect } from "react";

export const ErrorToast = () => {
  const { toast } = useToast();
  const [errorCode, setErrorCode] = useQueryState("errorCode");

  useEffect(() => {
    if (errorCode) {
      if (errorCode === "LEAGUE_PERMISSION") {
        clearLastVisitedLeague().then(() => {
          toast({
            title: "Access denied",
            description: "Insufficient league permissions",
            variant: "destructive",
            duration: 2000,
          });
        });
      } else if (errorCode === "LEAGUE_NOT_FOUND") {
        clearLastVisitedLeague().then(() => {
          toast({
            title: "Something went wrong",
            description: "League not found",
            variant: "destructive",
            duration: 2000,
          });
        });
      } else if (errorCode === "INVITE_NOT_FOUND") {
        toast({
          title: "Something went wrong",
          description: "Invite not found",
          variant: "destructive",
          duration: 2000,
        });
      } else if (errorCode === "INVITE_ALREADY_CLAIMED") {
        toast({
          title: "Something went wrong",
          description: "Invite already claimed",
          duration: 2000,
        });
      } else if (errorCode === "UNSUPPORTED_SCORE_TYPE") {
        toast({
          title: "Something went wrong",
          description: "Page not supported for this score type",
          duration: 2000,
        });
      } else if (errorCode === "PLAYER_PROFILE_NOT_SUPPORTED") {
        toast({
          title: "Feature not available",
          description: "League player profiles are not available for non-ELO seasons",
          variant: "destructive",
          duration: 3000,
        });
      } else {
        toast({
          title: "Something went wrong",
          description: `An error occurred: ${errorCode}`,
          variant: "destructive",
          duration: 2000,
        });
      }
      setErrorCode(null).then();
    }
  }, [errorCode, setErrorCode, toast]);

  return null;
};
