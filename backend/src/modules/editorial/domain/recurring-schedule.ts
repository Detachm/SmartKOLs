import { AppError } from "../../../core/errors/app-error";
import type { EditorialCadence, EditorialWeekdayCode } from "./editorial";

const WEEKDAY_BY_SHORT = new Map<string, EditorialWeekdayCode>([
  ["Mon", "mon"],
  ["Tue", "tue"],
  ["Wed", "wed"],
  ["Thu", "thu"],
  ["Fri", "fri"],
  ["Sat", "sat"],
  ["Sun", "sun"],
]);

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: EditorialWeekdayCode;
}

export function computeNextRecurringRunAfter(input: {
  cadence: EditorialCadence;
  now: string;
  not_before?: string;
}): string {
  const baseline = new Date(input.not_before ?? input.now);
  if (Number.isNaN(baseline.getTime())) {
    throw new AppError("INVALID_STATE", "baseline datetime is invalid", {
      details: { not_before: input.not_before, now: input.now },
    });
  }

  const zonedBaseline = getZonedParts(baseline, input.cadence.timezone);
  for (let dayOffset = 0; dayOffset <= 21; dayOffset += 1) {
    const localDate = addDays(zonedBaseline, dayOffset);
    if (!input.cadence.weekday_codes.includes(localDate.weekday)) {
      continue;
    }

    for (const slot of input.cadence.slot_times) {
      const [hour, minute] = slot.split(":").map((part) => Number(part));
      const candidate = resolveZonedDateTime({
        year: localDate.year,
        month: localDate.month,
        day: localDate.day,
        hour,
        minute,
      }, input.cadence.timezone);
      if (candidate.getTime() > baseline.getTime()) {
        return candidate.toISOString();
      }
    }
  }

  throw new AppError("INVALID_STATE", "could not compute next recurring run within 21 days", {
    details: { timezone: input.cadence.timezone },
  });
}

function addDays(parts: ZonedParts, days: number): ZonedParts {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    weekday: weekdayCodeFromDate(value),
  };
}

function weekdayCodeFromDate(value: Date): EditorialWeekdayCode {
  const short = value.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  const mapped = WEEKDAY_BY_SHORT.get(short);
  if (!mapped) {
    throw new AppError("INVALID_STATE", "unsupported weekday code", {
      details: { weekday: short },
    });
  }

  return mapped;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = WEEKDAY_BY_SHORT.get(get("weekday"));
  if (!weekday) {
    throw new AppError("INVALID_STATE", "could not resolve zoned weekday", {
      details: { time_zone: timeZone, weekday: get("weekday") },
    });
  }

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday,
  };
}

function resolveZonedDateTime(target: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}, timeZone: string): Date {
  let guess = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, 0, 0);
  const targetKey = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, 0, 0);

  for (let index = 0; index < 5; index += 1) {
    const actual = getZonedParts(new Date(guess), timeZone);
    const actualKey = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, 0, 0);
    const diff = targetKey - actualKey;
    if (diff === 0) {
      return new Date(guess);
    }
    guess += diff;
  }

  throw new AppError("INVALID_STATE", "could not resolve timezone-local run slot", {
    details: { time_zone: timeZone, target },
  });
}
