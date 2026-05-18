export type FraudFlag =
  | "outside_radius"
  | "poor_accuracy"
  | "duplicate_submission"
  | "late_submission"
  | "missing_selfie"
  | "outside_time_window";

export interface FraudCheckInput {
  distanceM: number;
  radiusM: number;
  accuracyM: number;
  withinTimeWindow: boolean;
  hasSelfie: boolean;
  hasExistingToday: boolean;
}

/** Detect fraud flags on a check-in submission. */
export function detectFraudFlags(input: FraudCheckInput): FraudFlag[] {
  const flags: FraudFlag[] = [];
  if (input.distanceM > input.radiusM) flags.push("outside_radius");
  if (input.accuracyM > 100) flags.push("poor_accuracy");
  if (!input.withinTimeWindow) flags.push("outside_time_window");
  if (!input.hasSelfie) flags.push("missing_selfie");
  if (input.hasExistingToday) flags.push("duplicate_submission");
  return flags;
}

export function flagLabel(flag: FraudFlag): string {
  const labels: Record<FraudFlag, string> = {
    outside_radius: "Outside School Radius",
    poor_accuracy: "Poor GPS Accuracy",
    duplicate_submission: "Duplicate Submission",
    late_submission: "Late Submission",
    missing_selfie: "Missing Selfie",
    outside_time_window: "Outside Time Window",
  };
  return labels[flag];
}
