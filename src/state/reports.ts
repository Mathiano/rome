/**
 * The report writer (reports unit). A report is the numbers behind a log
 * line: one call writes the prose through `log()` and the record beside it,
 * pointing at the line by `logId`. Nothing here decides anything; the module
 * that resolved the event hands over what it already computed.
 */
import { config } from '../data';
import type { GameState, LogEntry, Report, ReportDataByKind, ReportKind } from './types';
import { log } from './store';

export function report<K extends ReportKind>(
  state: GameState, kind: K, data: ReportDataByKind[K], text: string, logKind: LogEntry['kind'],
): Extract<Report, { kind: K }> {
  log(state, logKind, text);
  state.reportSeq = (state.reportSeq ?? 0) + 1;
  const r = { id: state.reportSeq, round: state.round, at: state.lastTick, kind, logId: state.logSeq, data } as Extract<Report, { kind: K }>;
  state.reports.push(r);
  if (state.reports.length > config.reports.max) state.reports.splice(0, state.reports.length - config.reports.max);
  return r;
}

/** Reports the player has not acknowledged: `seenLogId` is the one cursor for lines and records alike. */
export function unreadReports(state: GameState): Report[] {
  return state.reports.filter((r) => r.logId > state.seenLogId);
}

/** The reports a round wrote, in the order it wrote them. */
export function reportsOfRound(state: GameState, round: number): Report[] {
  return state.reports.filter((r) => r.round === round);
}
