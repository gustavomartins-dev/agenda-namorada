import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function fromDateKey(dateKey: string): Date {
  return parse(dateKey, 'yyyy-MM-dd', new Date());
}

export function formatLongDate(date: Date): string {
  const value = format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatShortDate(date: Date): string {
  return format(date, "d 'de' MMMM", { locale: ptBR });
}

export function formatMonthTitle(date: Date): string {
  const value = format(date, 'MMMM yyyy', { locale: ptBR });
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function getUpcomingDays(anchor: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(anchor, index));
}

export function getMonthGrid(anchor: Date): Date[] {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  return eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  });
}

export function getDayLabel(date: Date): string {
  return format(date, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3);
}

export function isTodayDate(date: Date): boolean {
  return isSameDay(date, new Date());
}

export { addDays, format, isSameDay, isSameMonth };

export function shiftDateKey(dateKey: string, amount: number): string {
  return toDateKey(addDays(fromDateKey(dateKey), amount));
}

export function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function eventSortValue(date: string, time: string): string {
  return `${date}T${time}`;
}
