import { AGENDA_TIME_ZONE } from '../../shared/assistant';

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: AGENDA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function partsInAgendaTimeZone(value: Date | string): ZonedParts | null {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;

  const values = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const parts = {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
  return Object.values(parts).every(Number.isFinite) ? parts : null;
}

function offsetAt(date: Date): number | null {
  const parts = partsInAgendaTimeZone(date);
  if (!parts) return null;
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const instantWithoutMilliseconds = Math.floor(date.getTime() / 1_000) * 1_000;
  return representedAsUtc - instantWithoutMilliseconds;
}

/** Converts an agenda wall-clock value using the real IANA rules for São Paulo. */
export function agendaWallTimeToDate(
  dateKey: string,
  time: string,
): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null;

  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const calendarCheck = new Date(desiredAsUtc);
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    return null;
  }

  let instant = desiredAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offset = offsetAt(new Date(instant));
    if (offset === null) return null;
    const next = desiredAsUtc - offset;
    if (next === instant) break;
    instant = next;
  }

  const result = new Date(instant);
  const resolved = partsInAgendaTimeZone(result);
  if (
    !resolved ||
    resolved.year !== year ||
    resolved.month !== month ||
    resolved.day !== day ||
    resolved.hour !== hour ||
    resolved.minute !== minute
  ) {
    return null;
  }
  return result;
}

export function agendaInstantToIso(date: Date): string | null {
  const parts = partsInAgendaTimeZone(date);
  const offsetMilliseconds = offsetAt(date);
  if (!parts || offsetMilliseconds === null) return null;

  const offsetMinutes = Math.round(offsetMilliseconds / 60_000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, '0')}:${String(absoluteOffset % 60).padStart(2, '0')}`;
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}${offset}`;
}
