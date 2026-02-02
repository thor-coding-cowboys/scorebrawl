"use client";
import { GetStartedStep } from "@/app/(onboarding)/onboarding/components/GetStartedStep";
import { ProfileStep } from "@/app/(onboarding)/onboarding/components/ProfileStep";
import { WelcomeStep } from "@/app/(onboarding)/onboarding/components/WelcomeStep";
import { Step, type StepItem, Stepper } from "@/components/stepper";
import { Card } from "@/components/ui/card";
import type { ReactNode } from "react";
import { Footer } from "./Footer";

const steps = [
  { label: "Welcome", component: <WelcomeStep /> },
  { label: "Profile", component: <ProfileStep /> },
  { label: "Get Started", component: <GetStartedStep /> },
] satisfies (StepItem & { component: ReactNode })[];

export const OnboardingStepper = () => {
  return (
    <Stepper initialStep={0} steps={steps}>
      {steps.map(({ label, component }, _index) => {
        return (
          <Step key={label} label={label}>
            <Card>{component}</Card>
          </Step>
        );
      })}
      <Footer />
    </Stepper>
  );
};
