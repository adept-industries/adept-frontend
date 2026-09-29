import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthProvider.js";
import { OnboardingTourContext, type TourSession, useOnboardingTour } from "./OnboardingTourContext.js";

interface OnboardingTourProps {
  pathname: string;
}

interface TourStep {
  path: string;
  targetIds: string[];
  title: string;
  message: string;
  placement?: "below" | "above";
}

interface PopoverPosition {
  top: number;
  left: number;
  pointerX: number;
  pointer: "top" | "bottom";
}

const STORAGE_KEY = "adept.onboarding.activeTour.v2";

const TOUR_STEPS: TourStep[] = [
  {
    path: "/dashboard",
    targetIds: ["sidebar-nav-dashboard"],
    title: "Start on your dashboard",
    message: "This is your home for project health, delivery metrics, pull request risk, and issues.",
  },
  {
    path: "/dashboard",
    targetIds: ["sidebar-nav-integrations"],
    title: "Go to Integrations",
    message: "Connect GitHub and Jira, configure repository settings, and choose which repositories to track.",
  },
  {
    path: "/dashboard/integrations",
    targetIds: ["connect-github-btn", "sync-github-btn", "github-integration-card", "connect-jira-btn", "sync-jira-btn", "jira-integration-card", "integrations-card-grid"],
    title: "Connect GitHub and Jira",
    message: "Connect the services you use. After connecting, sync them here so repositories and Jira projects appear.",
  },
  {
    path: "/dashboard/integrations",
    targetIds: ["tour-repo-settings", "repository-catalog"],
    title: "Edit repository settings",
    message: "Open Settings on a repository and choose its deployment signal and required patterns before tracking it.",
  },
  {
    path: "/dashboard/integrations",
    targetIds: ["tour-repo-tracking", "repository-catalog"],
    title: "Track a repository",
    message: "Tick the Track checkbox beside each repository you want Adept to monitor. Configure settings first if prompted.",
  },
  {
    path: "/dashboard/projects",
    targetIds: ["tour-project-create"],
    title: "Create a project",
    message: "Open Create to name a project. You’ll attach tracked repositories and assign Leads in the form.",
  },
  {
    path: "/dashboard/projects",
    targetIds: ["tour-project-repository-selection", "tour-project-create"],
    title: "Add repositories",
    message: "Select the tracked repositories that belong to this project. Open Create if the project form is closed.",
  },
  {
    path: "/dashboard/projects",
    targetIds: ["tour-project-lead-assignment", "tour-project-repository-selection", "tour-project-create"],
    title: "Assign repository Leads",
    message: "For each selected repository, choose the teammates who will lead its work.",
  },
  {
    path: "/dashboard",
    targetIds: ["sidebar-nav-dashboard", "project-selector", "dash-title"],
    title: "Check your dashboard",
    message: "Select your project to see its results. The first repository sync can take a few minutes, so metrics may appear later.",
  },
  {
    path: "/dashboard/alerts",
    targetIds: ["create-alert-btn"],
    title: "Set up alerts",
    message: "Create optional email alerts for repository metrics that cross a threshold.",
  },
  {
    path: "/dashboard/teams",
    targetIds: ["sidebar-nav-teams"],
    title: "Open team chat",
    message: "Use the project channel to coordinate with its assigned Leads. You can finish the tour here.",
    placement: "below",
  },
];

function readTourSession(): TourSession | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "userId" in parsed &&
      typeof parsed.userId === "string" &&
      "stepIndex" in parsed &&
      typeof parsed.stepIndex === "number" &&
      Number.isInteger(parsed.stepIndex) &&
      parsed.stepIndex >= 0 &&
      parsed.stepIndex < TOUR_STEPS.length
    ) {
      return { userId: parsed.userId, stepIndex: parsed.stepIndex };
    }
  } catch {
    return null;
  }
  return null;
}

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const [activeTour, setActiveTour] = useState<TourSession | null>(readTourSession);
  const [deferredUserId, setDeferredUserId] = useState<string | null>(null);

  const saveTourSession = useCallback((next: TourSession | null) => {
    setActiveTour(next);
    try {
      if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
  }, []);

  const startTour = useCallback((userId: string) => {
    setDeferredUserId(null);
    saveTourSession({ userId, stepIndex: 0 });
  }, [saveTourSession]);

  const setStep = useCallback((stepIndex: number) => {
    setActiveTour((current) => {
      if (!current || stepIndex < 0 || stepIndex >= TOUR_STEPS.length) return current;
      const next = { ...current, stepIndex };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        return next;
      }
      return next;
    });
  }, []);

  const exitTour = useCallback(() => saveTourSession(null), [saveTourSession]);
  const deferTour = useCallback((userId: string) => setDeferredUserId(userId), []);

  const value = useMemo(() => ({
    activeTour,
    deferredUserId,
    startTour,
    setStep,
    exitTour,
    deferTour,
  }), [activeTour, deferredUserId, startTour, setStep, exitTour, deferTour]);

  return <OnboardingTourContext.Provider value={value}>{children}</OnboardingTourContext.Provider>;
}

export function OnboardingTour({ pathname }: OnboardingTourProps) {
  const { state, actions } = useAuth();
  const navigate = useNavigate();
  const tour = useOnboardingTour();
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = state.status === "authenticated" ? state.user : null;
  const activeTour = user?.id === tour.activeTour?.userId ? tour.activeTour : null;
  const step = activeTour ? TOUR_STEPS[activeTour.stepIndex] : null;
  const isPromptVisible = Boolean(
    pathname === "/dashboard" &&
    user &&
    !user.onboardingComplete &&
    !activeTour &&
    tour.deferredUserId !== user.id,
  );
  const isStepVisible = Boolean(step && step.path === pathname);

  useEffect(() => {
    setPosition(null);
    if (!isPromptVisible && !isStepVisible) return;

    const targetIds = isPromptVisible ? ["dash-title"] : step?.targetIds ?? [];
    let didScrollToTarget = false;
    const updatePosition = () => {
      const target = targetIds
        .map((id) => document.getElementById(id))
        .find((element): element is HTMLElement => element !== null);
      if (!target) return;

      const initialRect = target.getBoundingClientRect();
      const height = isPromptVisible ? 230 : 220;
      const needsBelowSpace = step?.placement === "below" && initialRect.bottom + height + 16 > window.innerHeight;
      if (!didScrollToTarget && (initialRect.top < 0 || initialRect.bottom > window.innerHeight || needsBelowSpace)) {
        target.scrollIntoView?.({ behavior: "smooth", block: needsBelowSpace ? "start" : "center" });
        didScrollToTarget = true;
      }
      const rect = target.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 24);
      const isBelowTarget = step?.placement === "below"
        || (step?.placement !== "above" && rect.bottom + height + 16 <= window.innerHeight);
      const candidateTop = isBelowTarget
        ? rect.bottom + 12
        : rect.top - height - 12;
      const maxTop = Math.max(12, window.innerHeight - height - 12);
      const top = Math.min(Math.max(12, candidateTop), maxTop);
      const targetCenterX = rect.left + rect.width / 2;
      const maxLeft = Math.max(12, window.innerWidth - width - 12);
      const left = Math.min(Math.max(targetCenterX - width / 2, 12), maxLeft);
      const pointerX = targetCenterX - left - 2;
      setPosition({ top, left, pointerX, pointer: isBelowTarget ? "top" : "bottom" });
    };

    const frame = window.requestAnimationFrame(updatePosition);
    const mutationObserver = new MutationObserver(updatePosition);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isPromptVisible, isStepVisible, step, pathname]);

  const goToStep = (stepIndex: number) => {
    const nextStep = TOUR_STEPS[stepIndex];
    tour.setStep(stepIndex);
    if (pathname !== nextStep.path) void navigate(nextStep.path);
  };

  const completeTour = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await actions.completeOnboarding();
      tour.exitTour();
      if (pathname !== "/dashboard") void navigate("/dashboard");
    } catch {
      setError("We couldn't save your onboarding status. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const startTour = () => {
    if (!user) return;
    tour.startTour(user.id);
    if (pathname !== TOUR_STEPS[0].path) void navigate(TOUR_STEPS[0].path);
  };

  const leaveTour = () => {
    if (user) tour.deferTour(user.id);
    tour.exitTour();
  };

  if (!user) return null;

  if (isPromptVisible && position) {
    return (
      <aside
        className="onboarding-tour onboarding-tour--prompt"
        role="region"
        aria-label="Getting started"
        data-pointer={position.pointer}
        style={{
          top: position.top,
          left: position.left,
          "--pointer-x": `${position.pointerX}px`,
        } as CSSProperties}
      >
        <div className="onboarding-tour__eyebrow">Welcome to Adept</div>
        <h2 className="onboarding-tour__title">A quick tour to get you started</h2>
        <p className="onboarding-tour__message">
          Start on your dashboard, connect your tools, and set up your first project.
        </p>
        {error && <p className="onboarding-tour__error" role="alert">{error}</p>}
        <div className="onboarding-tour__actions">
          <button type="button" className="onboarding-tour__quiet" onClick={() => tour.deferTour(user.id)}>
            Maybe later
          </button>
          <button type="button" className="onboarding-tour__quiet" onClick={() => void completeTour()} disabled={saving}>
            Skip tour
          </button>
          <button type="button" className="onboarding-tour__primary" onClick={startTour}>
            Start tour
          </button>
        </div>
      </aside>
    );
  }

  if (activeTour && step && !isStepVisible) {
    const resume = () => {
      if (pathname !== step.path) void navigate(step.path);
    };
    return (
      <aside className="onboarding-tour onboarding-tour--paused" role="status">
        <p className="onboarding-tour__message">Your tour is paused.</p>
        <div className="onboarding-tour__actions">
          <button type="button" className="onboarding-tour__quiet" onClick={leaveTour}>Exit tour</button>
          <button type="button" className="onboarding-tour__primary" onClick={resume}>Resume tour</button>
        </div>
      </aside>
    );
  }

  if (!activeTour || !step || !position) return null;

  const isLastStep = activeTour.stepIndex === TOUR_STEPS.length - 1;

  return (
    <aside
      className="onboarding-tour"
      role="dialog"
      aria-label={`${step.title}, step ${activeTour.stepIndex + 1} of ${TOUR_STEPS.length}`}
      data-pointer={position.pointer}
      style={{
        top: position.top,
        left: position.left,
        "--pointer-x": `${position.pointerX}px`,
      } as CSSProperties}
    >
      <div className="onboarding-tour__eyebrow">Step {activeTour.stepIndex + 1} of {TOUR_STEPS.length}</div>
      <h2 className="onboarding-tour__title">{step.title}</h2>
      <p className="onboarding-tour__message">{step.message}</p>
      {error && <p className="onboarding-tour__error" role="alert">{error}</p>}
      <div className="onboarding-tour__actions">
        <button type="button" className="onboarding-tour__quiet" onClick={leaveTour}>Exit</button>
        <div className="onboarding-tour__step-actions">
          {activeTour.stepIndex > 0 && (
            <button type="button" className="onboarding-tour__quiet" onClick={() => goToStep(activeTour.stepIndex - 1)}>
              Back
            </button>
          )}
          {isLastStep ? (
            <button type="button" className="onboarding-tour__primary" onClick={() => void completeTour()} disabled={saving}>
              {saving ? "Saving…" : "Finish"}
            </button>
          ) : (
            <button type="button" className="onboarding-tour__primary" onClick={() => goToStep(activeTour.stepIndex + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
