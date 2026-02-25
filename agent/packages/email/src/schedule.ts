import { CronExpressionParser } from "cron-parser";

/**
 * Check if an account is due for a sweep based on its cron schedule.
 * Compares the last cron occurrence against lastCheckedAt.
 */
export function isAccountDue(
  cronExpression: string,
  lastCheckedAt: string | null
): boolean {
  if (!lastCheckedAt) return true;

  const interval = CronExpressionParser.parse(cronExpression);
  const prevOccurrence = interval.prev().toDate();
  const lastChecked = new Date(lastCheckedAt);

  return prevOccurrence > lastChecked;
}
