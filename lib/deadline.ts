export const APPLICATION_DEADLINE = new Date("2026-08-13T23:59:59.999+09:00");

export const APPLICATION_DEADLINE_LABEL = "2026년 8월 13일 (목) 23:59";

export function isApplicationClosed(now: Date = new Date()): boolean {
  return now.getTime() > APPLICATION_DEADLINE.getTime();
}
