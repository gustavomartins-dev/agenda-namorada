import { describe, expect, it } from 'vitest';

import {
  agendaInstantToIso,
  agendaWallTimeToDate,
} from './timeZone';

describe('fuso da agenda', () => {
  it('converte o horário civil atual de São Paulo sem fixar o offset', () => {
    const date = agendaWallTimeToDate('2030-08-30', '15:00');
    expect(date?.toISOString()).toBe('2030-08-30T18:00:00.000Z');
    expect(date && agendaInstantToIso(date)).toBe('2030-08-30T15:00:00-03:00');
  });

  it('respeita regras históricas do IANA quando o offset era diferente', () => {
    const date = agendaWallTimeToDate('2018-01-15', '10:00');
    expect(date?.toISOString()).toBe('2018-01-15T12:00:00.000Z');
    expect(date && agendaInstantToIso(date)).toBe('2018-01-15T10:00:00-02:00');
  });

  it('recusa data civil inválida', () => {
    expect(agendaWallTimeToDate('2030-02-30', '15:00')).toBeNull();
  });
});
