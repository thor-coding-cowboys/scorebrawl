"use client";

import { useStepper } from "@/components/stepper";
import { Button } from "@/components/ui/button";

export const Footer = () => {
  const {
    nextStep,
    prevStep,
    resetSteps,
    activeStep,
    initialStep,
    hasCompletedAllSteps,
    isLastStep,
    isOptionalStep,
  } = useStepper();
  return (
    <>
      {hasCompletedAllSteps && (
        <div className="h-40 flex items-center justify-center my-4 border bg-secondary text-primary rounded-md">
          <h1 className="text-xl">Woohoo! All steps completed! 🎉</h1>
        </div>
      )}
      <div className="w-full flex justify-end gap-2">
        {hasCompletedAllSteps ? (
          <Button size="sm" onClick={resetSteps}>
            Reset
          </Button>
        ) : (
          <>
            {initialStep !== activeStep && (
              <Button onClick={prevStep} size="sm" variant="secondary">
                Prev
              </Button>
            )}
            {!isLastStep && (
              <Button size="sm" onClick={nextStep}>
                {isOptionalStep ? "Skip" : "Next"}
              </Button>
            )}
          </>
        )}
      </div>
    </>
  );
};
