// ============================================================
// src/utils/scheduleAlgorithm.ts  ── 完全修正版
// 修正点:
//   1. applyAkeForDate を「その日の通常割当て前」に実行  ★最重要
//   2. 月初日の前日(前月末日)夜勤を IndexedDB から参照
//   3. 有給リクエスト強制割当て時に明け予定日をスキップ
//   4. hasAkePattern を constructor でキャッシュ
//   5. isNightShift の判定を名前・パターン両方で行う
// ============================================================

import { db } from '../db';
import type {
  Staff,
  ShiftPattern,
  ScheduleConstraints,
  ScheduleGenerationParams,
  GeneratedSchedule,
  ConstraintViolation,
  ScheduleGenerationResult,
  ShiftRequest,
} from '../types';

const AKE_NAME = '明け';
const VACATION_NAME = '有給';
const REST_NAME = '休み';

// ──────────────────────────────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────────────────────────────
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getMonthDates(year: number, month: number): string[] {
  const days = getDaysInMonth(year, month);
  return Array.from({ length: days }, (_, i) => formatDate(year, month, i + 1));
}

// ──────────────────────────────────────────────────────────────
// ScheduleGenerator クラス
// ──────────────────────────────────────────────────────────────
export class ScheduleGenerator {
  private staff: Staff[];
  private allPatterns: ShiftPattern[];
  private constraints: ScheduleConstraints[];
  private requests: ShiftRequest[];
  private params: ScheduleGenerationParams;
  private schedules: GeneratedSchedule[] = [];
  private violations: ConstraintViolation[] = [];

  // ── キャッシュ ──
  private hasAkePattern = false;
  private akePattern: ShiftPattern | undefined;
  private hasVacationPattern = false;
  private vacationPattern: ShiftPattern | undefined;

  // 月境界: 前月末夜勤スタッフID
  private prevMonthLastDayNightStaffIds: Set<string | number> = new Set();

  constructor(
    staff: Staff[],
    allPatterns: ShiftPattern[],
    constraints: ScheduleConstraints[],
    requests: ShiftRequest[],
    params: ScheduleGenerationParams,
  ) {
    this.staff = staff;
    this.allPatterns = allPatterns;
    this.constraints = constraints;
    this.requests = requests;
    this.params = params;

    this.akePattern = allPatterns.find(p => p.isAke || p.name === AKE_NAME);
    this.hasAkePattern = !!this.akePattern;
    this.vacationPattern = allPatterns.find(p => p.isVacation || p.name === VACATION_NAME);
    this.hasVacationPattern = !!this.vacationPattern;

    console.log(`[SG] 明けパターン: ${this.hasAkePattern ? '✅' : '❌'}  有給: ${this.hasVacationPattern ? '✅' : '❌'}`);
  }

  // ── 前月末の夜勤情報ロード（月初1日の境界対応）──────────────
  async loadPrevMonthLastDayNightShifts(): Promise<void> {
    if (!this.hasAkePattern) return;
    const { year, month } = this.params;
    const py = month === 1 ? year - 1 : year;
    const pm = month === 1 ? 12 : month - 1;
    const lastDate = formatDate(py, pm, getDaysInMonth(py, pm));
    try {
      const rows = await db.generatedSchedules.where('date').equals(lastDate).toArray();
      this.prevMonthLastDayNightStaffIds = new Set(
        rows.filter(s => this.isNightShift(s.shiftType)).map(s => s.staffId),
      );
      console.log(`[SG] 前月末夜勤スタッフ数 (${lastDate}):`, this.prevMonthLastDayNightStaffIds.size);
    } catch (e) {
      console.warn('[SG] 前月末夜勤ロード失敗:', e);
    }
  }

  // ── メイン生成 ────────────────────────────────────────────────
  async generate(): Promise<ScheduleGenerationResult> {
    await this.loadPrevMonthLastDayNightShifts();
    const { year, month } = this.params;
    const dates = getMonthDates(year, month);

    // Pass 1: 有給を先行確定（ただし明け予定日はスキップ）
    this.pass1VacationRequests(dates);

    // Pass 2: 日次割当て ─ 各日で「先に明け → 後に通常割当て」
    for (const date of dates) {
      if (this.hasAkePattern) this.applyAkeForDate(date);  // ★ 通常割当て前に実行
      this.assignDailyShifts(date);
    }

    // Pass 3: exactRestDaysPerMonth 調整
    this.adjustRestDays(dates);

    // Pass 4: minWorkDaysPerMonth 保証
    this.enforceMinWorkDays(dates);

    return {
      schedules: this.schedules,
      violations: this.violations,
      statistics: this.calcStatistics(dates),
      generatedAt: new Date().toISOString(),
      year,
      month,
    };
  }

  // ── Pass 1 ────────────────────────────────────────────────────
  private pass1VacationRequests(dates: string[]): void {
    if (!this.hasVacationPattern) return;
    const vacReqs = this.requests.filter(
      r => r.shiftType === VACATION_NAME || r.patternId === this.vacationPattern!.id,
    );
    for (const req of vacReqs) {
      const d = req.date.slice(0, 10);
      if (!dates.includes(d)) continue;
      if (this.willBeAke(req.staffId, d)) {
        console.log(`[P1] ${req.staffId} ${d} 明け予定のため有給スキップ`);
        continue;
      }
      if (!this.getSch(req.staffId, d)) this.push(req.staffId, d, VACATION_NAME);
    }
  }

  // ── 「翌日明け予定か」判定 ────────────────────────────────────
  private willBeAke(staffId: string | number, date: string): boolean {
    if (!this.hasAkePattern) return false;
    const prev = this.getSch(staffId, addDays(date, -1));
    if (prev && this.isNightShift(prev.shiftType)) return true;
    const { year, month } = this.params;
    if (date === formatDate(year, month, 1)) {
      return this.prevMonthLastDayNightStaffIds.has(staffId);
    }
    return false;
  }

  // ── 明け付与（★通常割当て前に呼ぶ） ──────────────────────────
  private applyAkeForDate(date: string): void {
    const { year, month } = this.params;
    const isFirst = date === formatDate(year, month, 1);
    const prevDate = addDays(date, -1);

    for (const st of this.staff) {
      if (this.getSch(st.id, date)) continue; // 既に有給等が入っている → スキップ

      const isNightPrev = isFirst
        ? this.prevMonthLastDayNightStaffIds.has(st.id)
        : (() => {
            const ps = this.getSch(st.id, prevDate);
            return !!(ps && this.isNightShift(ps.shiftType));
          })();

      if (isNightPrev) {
        this.push(st.id, date, AKE_NAME);
        console.log(`[applyAke] ✅ ${st.name} ${date} 明け付与`);
      }
    }
  }

  // ── 日次シフト割当て ──────────────────────────────────────────
  private assignDailyShifts(date: string): void {
    // リクエスト優先
    for (const req of this.requests.filter(r => r.date.slice(0, 10) === date)) {
      if (this.getSch(req.staffId, date)) continue;
      if (req.shiftType === VACATION_NAME) continue;
      if (this.canAssign(req.staffId, date, req.shiftType)) {
        this.push(req.staffId, date, req.shiftType);
      }
    }
    // 未割当て → 勤務 or 休み
    for (const st of this.staff) {
      if (this.getSch(st.id, date)) continue;
      this.push(st.id, date, this.decideShift(st, date));
    }
  }

  private decideShift(st: Staff, date: string): string {
    if (!this.canWork(st.id, date)) return REST_NAME;
    const wp = this.allPatterns.find(p => !p.isAke && !p.isVacation && p.name !== REST_NAME);
    return wp ? wp.name : REST_NAME;
  }

  // ── 連続勤務チェック ──────────────────────────────────────────
  private canWork(staffId: string | number, date: string): boolean {
    const max = this.constraints[0]?.maxConsecutiveWorkDays ?? 3;
    let consec = 0;
    let d = addDays(date, -1);
    for (let i = 0; i < max; i++) {
      const s = this.getSch(staffId, d);
      if (s && this.isWorkShift(s.shiftType)) consec++;
      else break;
      d = addDays(d, -1);
    }
    return consec < max;
  }

  private canAssign(staffId: string | number, date: string, shiftType: string): boolean {
    if (!this.canWork(staffId, date)) return false;
    if (this.hasAkePattern) {
      const ps = this.getSch(staffId, addDays(date, -1));
      if (ps && this.isNightShift(ps.shiftType)) return shiftType === AKE_NAME;
    }
    return true;
  }

  // ── Pass 3: 休み日数調整 ──────────────────────────────────────
  private adjustRestDays(dates: string[]): void {
    const target = this.constraints[0]?.exactRestDaysPerMonth ?? 0;
    if (target <= 0) return;
    for (const st of this.staff) {
      const cur = this.countRest(st.id, dates);
      const diff = target - cur;
      if (diff > 0) {
        let n = diff;
        for (const d of dates) {
          if (n <= 0) break;
          const s = this.getSch(st.id, d);
          if (s && this.isWorkShift(s.shiftType)) { this.overwrite(st.id, d, REST_NAME); n--; }
        }
      } else if (diff < 0) {
        let n = Math.abs(diff);
        for (const d of dates) {
          if (n <= 0) break;
          const s = this.getSch(st.id, d);
          if (s && s.shiftType === REST_NAME && this.canAssign(st.id, d, '日勤')) {
            const wp = this.allPatterns.find(p => !p.isAke && !p.isVacation && p.name !== REST_NAME);
            if (wp) { this.overwrite(st.id, d, wp.name); n--; }
          }
        }
      }
    }
  }

  // ── Pass 4: 最低勤務日数保証 ──────────────────────────────────
  private enforceMinWorkDays(dates: string[]): void {
    for (const st of this.staff) {
      const min = (st as any).minWorkDaysPerMonth ?? 0;
      if (min <= 0) continue;
      let deficit = min - this.countWork(st.id, dates);
      if (deficit <= 0) continue;
      console.log(`🔧 ${st.name} 最低勤務: ${min}日, 現在: ${min - deficit}日, 不足: ${deficit}日`);
      for (const d of dates) {
        if (deficit <= 0) break;
        const s = this.getSch(st.id, d);
        if (s && s.shiftType === REST_NAME && this.canAssign(st.id, d, '日勤')) {
          const wp = this.allPatterns.find(p => !p.isAke && !p.isVacation && p.name !== REST_NAME);
          if (wp) { this.overwrite(st.id, d, wp.name); deficit--; }
        }
      }
      if (deficit > 0) {
        this.violations.push({
          staffId: String(st.id), staffName: st.name,
          date: formatDate(this.params.year, this.params.month, 1),
          type: 'warning',
          message: `${st.name}: 最低勤務日数(${min}日)を${deficit}日達成できませんでした`,
        });
      }
    }
  }

  // ── 判定ユーティリティ ────────────────────────────────────────

  /** 夜勤判定: 名前 + パターンフラグ両方チェック */
  private isNightShift(shiftType: string): boolean {
    if (!shiftType) return false;
    const lower = shiftType.toLowerCase();
    if (lower.includes('夜勤') || lower.includes('night') || lower.includes('ナイト')) return true;
    const p = this.allPatterns.find(pat => pat.name === shiftType);
    return !!(p && (p as any).isNight);
  }

  /** 勤務扱い判定（休み・明け・有給は除外） */
  private isWorkShift(t: string): boolean {
    return t !== REST_NAME && t !== AKE_NAME && t !== VACATION_NAME;
  }

  // ── データアクセスヘルパー ────────────────────────────────────
  private getSch(staffId: string | number, date: string): GeneratedSchedule | undefined {
    return this.schedules.find(s => s.staffId === staffId && s.date === date);
  }

  private push(staffId: string | number, date: string, shiftType: string): void {
    const st = this.staff.find(s => s.id === staffId);
    this.schedules.push({ staffId, staffName: st?.name ?? '', date, shiftType, isGenerated: true } as GeneratedSchedule);
  }

  private overwrite(staffId: string | number, date: string, shiftType: string): void {
    const i = this.schedules.findIndex(s => s.staffId === staffId && s.date === date);
    if (i >= 0) this.schedules[i] = { ...this.schedules[i], shiftType };
  }

  private countWork(staffId: string | number, dates: string[]): number {
    return dates.filter(d => { const s = this.getSch(staffId, d); return s && this.isWorkShift(s.shiftType); }).length;
  }

  private countRest(staffId: string | number, dates: string[]): number {
    return dates.filter(d => this.getSch(staffId, d)?.shiftType === REST_NAME).length;
  }

  // ── 統計計算 ──────────────────────────────────────────────────
  private calcStatistics(dates: string[]) {
    return {
      totalDays: dates.length,
      staffStats: this.staff.map(st => ({
        staffId: st.id, staffName: st.name,
        workDays: this.countWork(st.id, dates),
        restDays: this.countRest(st.id, dates),
        akeDays: dates.filter(d => this.getSch(st.id, d)?.shiftType === AKE_NAME).length,
        vacationDays: dates.filter(d => this.getSch(st.id, d)?.shiftType === VACATION_NAME).length,
      })),
    };
  }
}
