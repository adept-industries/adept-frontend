import { createContext, useContext } from "react";

export interface TourSession {
  userId: string;
  stepIndex: number;
}

export interface OnboardingTourContextValue {
  activeTour: TourSession | null;
  deferredUserId: string | null;
  startTour(userId: string): void;
  setStep(stepIndex: number): void;
  exitTour(): void;
  deferTour(userId: string): void;
}

const emptyContext: OnboardingTourContextValue = {
  activeTour: null,
  deferredUserId: null,
  startTour: () => undefined,
  setStep: () => undefined,
  exitTour: () => undefined,
  deferTour: () => undefined,
};

export const OnboardingTourContext = createContext(emptyContext);

export function useOnboardingTour(): OnboardingTourContextValue {
  return useContext(OnboardingTourContext);
}
