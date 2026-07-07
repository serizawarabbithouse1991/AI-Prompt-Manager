const ONBOARDING_COMPLETE_KEY = "ai-fm-onboarding-complete";

export function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingComplete(): void {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
  } catch {
    // ignore
  }
}

export function resetOnboardingForDebug(): void {
  try {
    localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  } catch {
    // ignore
  }
}
