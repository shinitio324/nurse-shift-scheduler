// src/utils/scheduleAlgorithm.ts
import { db } from '../db';
import type {
  Staff,
  ShiftPattern,
  ShiftRequest,
  ScheduleConstraints,
  GeneratedShift,
  ScheduleGenerationParams,
  ScheduleGenerationResult,
  ScheduleStatistics,
  StaffWorkloadStat,
} from '../types';

// ─────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────
export const AKE_NAME      = '明け';
export const VACATION_NAME = '有給';
export const REST_NAME     = '休み';

// ─────────────────────────────────────────────
// ユーティリティ（モジュールレベル関数 ― paramsに一切触れない）
// ─────────────────────────────────────────────
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonthDates(year: number, month: number): string[] {
  const days = getDaysInMonth(year, month);
  return Array.from({ length: days }, (_, i) =>
    formatDate(new Date(year, month - 1, i + 1))
  );
}

// ─────────────────────────────────────────────
// ScheduleGenerator クラス
// ─────────────────────────────────────────────
export class ScheduleGenerator {
  // ✅ 型宣言のみ（= で初期値を入れない）
  private year: number;
  private month: number;
  private akePatternId: number | null;
  private vacationPatternId: number | null;
  private restPatternId: number | null;
  private prevNightStaffIds: Set<number>;

  // ✅ params は constructor の引数としてのみ受け取る
  constructor(params: ScheduleGenerationParams) {
    // year / month のフォールバック（targetYear/targetMonth にも対応）
    const p = params as any;
    this.year  = p.year  ?? p.targetYear  ?? new Date().getFullYear();
    this.month = p.month ?? p.targetMonth ?? (new Date().getMonth() + 1);

    this.akePatternId      = null;
    this.vacationPatternId = null;
    this.restPatternId     = null;
    this.prevNightStaffIds = new Set();
  }

  // ─────────────────────────────────────────
  // メインエントリ
  // ─────────────────────────────────────────
  async generate(): Promise<ScheduleGenerationResult> {
    const patterns    = await db.shiftPatterns.toArray();
    const staff       = await db.staff.toArray();
    const requests    = await db.shiftRequests.toArray();
    const constraints = (await db.constraints.orderBy('id').last()) ?? ({} as ScheduleConstraints);
    const dates       = getMonthDates(this.year, this.month);

    // パターンID解決
    const akePat      = patterns.find(p => p.isAke      || p.name === AKE_NAME);
    const vacationPat = patterns.find(p => p.isVacation || p.name === VACATION_NAME);
    const restPat     = patterns.find(p => p.name === REST_NAME);

    this.akePatternId      = akePat?.id      ?? null;
    this.vacationPatternId = vacationPat?.id  ?? null;
    this.restPatternId     = restPat?.id      ?? null;

    console.log(`[SG] ${this.year}年${this.month}月  明け:${akePat ? '✅' : '❌'}  有給:${vacationPat ? '✅' : '❌'}`);
    console.log(`[SG] 対象日数: ${dates.length}日 / スタッフ: ${staff.length}人`);

    // 前月末夜勤スタッフ取得
    await this.loadPrevNightStaff(patterns);

    const schedule: GeneratedShift[] = [];

    // Pass1: 有給リクエスト（明け予定日はスキップ）
    this.applyVacationRequests(schedule, requests, dates);

    // Pass2: 日ごとに「明け → 通常シフト」の順で割当
    for (const dateStr of dates) {
      await this.applyAkeForDate(dateStr, schedule, staff, patterns);
      this.assignDailyShifts(dateStr, schedule, staff, requests, patterns, constraints);
    }

    // Pass3: 休み日数調整
    this.adjustRestDays(schedule, staff, constraints, dates);

    // Pass4: 最低勤務日数チェック
    this.enforceMinWorkDays(schedule, staff, constraints, patterns);

    const statistics = this.calcStatistics(schedule, staff, patterns, dates);

    console.log(`[SG] 生成完了: ${schedule.length}件`);
    return { schedule, statistics, warnings: [] };
  }

  // ─────────────────────────────────────────
  // 前月末夜勤スタッフ取得
  // ─────────────────────────────────────────
  private async loadPrevNightStaff(patterns: ShiftPattern[]): Promise<void> {
    try {
      const prevMonth = this.month === 1 ? 12 : this.month - 1;
      const prevYear  = this.month === 1 ? this.year - 1 : this.year;
      const lastDay   = getDaysInMonth(prevYear, prevMonth);
      const lastDate  = formatDate(new Date(prevYear, prevMonth - 1, lastDay));

      const prevShifts = await db.generatedSchedules
        .where('date').equals(lastDate)
        .toArray();

      for (const s of prevShifts) {
        const pat = patterns.find(p => p.id === s.patternId);
        if (pat && this.isNightShift(pat)) {
          this.prevNightStaffIds.add(s.staffId);
        }
      }
      console.log(`[SG] 前月末夜勤: ${this.prevNightStaffIds.size}人`);
    } catch (e) {
      console.warn('[SG] 前月末夜勤取得スキップ:', e);
    }
  }

  // ─────────────────────────────────────────
  // 明け割当
  // ─────────────────────────────────────────
  private async applyAkeForDate(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    patterns: ShiftPattern[]
  ): Promise<void> {
    if (!this.akePatternId) return;

    const dateObj    = new Date(dateStr);
    const isFirstDay = dateObj.getDate() === 1;
    const prevDate   = formatDate(addDays(dateObj, -1));

    for (const member of staff) {
      let needsAke = false;

      if (isFirstDay) {
        needsAke = this.prevNightStaffIds.has(member.id!);
      } else {
        const prev = schedule.find(s => s.staffId === member.id && s.date === prevDate);
        if (prev) {
          const pat = patterns.find(p => p.id === prev.patternId);
          needsAke = !!pat && this.isNightShift(pat);
        }
      }

      if (!needsAke) continue;

      const entry: GeneratedShift = {
        staffId:   member.id!,
        date:      dateStr,
        patternId: this.akePatternId,
        isManual:  false,
      };
      const idx = schedule.findIndex(s => s.staffId === member.id && s.date === dateStr);
      if (idx >= 0) {
        schedule[idx] = entry;
      } else {
        schedule.push(entry);
      }
      console.log(`[applyAke] ✅ ID:${member.id} ${dateStr} 明け`);
    }
  }

  // ─────────────────────────────────────────
  // 有給リクエスト適用
  // ─────────────────────────────────────────
  private applyVacationRequests(
    schedule: GeneratedShift[],
    requests: ShiftRequest[],
    dates: string[]
  ): void {
    if (!this.vacationPatternId) return;
    for (const req of requests) {
      if (req.patternId !== this.vacationPatternId) continue;
      if (!dates.includes(req.date)) continue;
      schedule.push({
        staffId:   req.staffId,
        date:      req.date,
        patternId: this.vacationPatternId,
        isManual:  false,
      });
    }
  }

  // ─────────────────────────────────────────
  // 日次シフト割当
  // ─────────────────────────────────────────
  private assignDailyShifts(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    requests: ShiftRequest[],
    patterns: ShiftPattern[],
    constraints: ScheduleConstraints
  ): void {
    const workPats = patterns.filter(p => !p.isAke && !p.isVacation && p.name !== REST_NAME);
    if (workPats.length === 0) return;

    for (const member of staff) {
      // 既に割当済みならスキップ
      if (schedule.some(s => s.staffId === member.id && s.date === dateStr)) continue;

      const req = requests.find(r => r.staffId === member.id && r.date === dateStr);
      const patternId = req ? req.patternId : workPats[0].id!;

      schedule.push({
        staffId:   member.id!,
        date:      dateStr,
        patternId,
        isManual:  !!req,
      });
    }
  }

  // ─────────────────────────────────────────
  // 休み調整 Pass3
  // ─────────────────────────────────────────
  private adjustRestDays(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints,
    dates: string[]
  ): void {
    if (!this.restPatternId) return;
    const target = (constraints as any).exactRestDaysPerMonth as number | undefined;
    if (!target) return;

    for (const member of staff) {
      const mine    = schedule.filter(s => s.staffId === member.id);
      const resting = mine.filter(s => s.patternId === this.restPatternId).length;
      const diff    = target - resting;
      if (diff <= 0) continue;

      const workable = mine.filter(
        s => s.patternId !== this.restPatternId &&
             s.patternId !== this.akePatternId &&
             s.patternId !== this.vacationPatternId
      );
      for (let i = 0; i < diff && i < workable.length; i++) {
        const idx = schedule.indexOf(workable[i]);
        if (idx >= 0) schedule[idx].patternId = this.restPatternId!;
      }
    }
  }

  // ─────────────────────────────────────────
  // 最低勤務日数 Pass4
  // ─────────────────────────────────────────
  private enforceMinWorkDays(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints,
    patterns: ShiftPattern[]
  ): void {
    const minDays = (constraints as any).minWorkDaysPerMonth as number | undefined;
    if (!minDays) return;

    for (const member of staff) {
      const workDays = schedule.filter(s => {
        if (s.staffId !== member.id) return false;
        const p = patterns.find(x => x.id === s.patternId);
        return p && !p.isAke && !p.isVacation && p.name !== REST_NAME;
      }).length;

      if (workDays < minDays) {
        console.warn(`[SG] ⚠️ ID:${member.id} ${member.name} 勤務${workDays}日 < 最低${minDays}日`);
      }
    }
  }

  // ─────────────────────────────────────────
  // 統計計算
  // ─────────────────────────────────────────
  private calcStatistics(
    schedule: GeneratedShift[],
    staff: Staff[],
    patterns: ShiftPattern[],
    dates: string[]
  ): ScheduleStatistics {
    const staffWorkload: StaffWorkloadStat[] = staff.map(member => {
      const mine = schedule.filter(s => s.staffId === member.id);

      const workDays = mine.filter(s => {
        const p = patterns.find(x => x.id === s.patternId);
        return p && !p.isAke && !p.isVacation && p.name !== REST_NAME;
      }).length;

      const restDays = mine.filter(s => {
        const p = patterns.find(x => x.id === s.patternId);
        return p?.name === REST_NAME;
      }).length;

      const akeDays = mine.filter(s => {
        const p = patterns.find(x => x.id === s.patternId);
        return !!p?.isAke;
      }).length;

      const vacationDays = mine.filter(s => {
        const p = patterns.find(x => x.id === s.patternId);
        return !!p?.isVacation;
      }).length;

      const nightDays = mine.filter(s => {
        const p = patterns.find(x => x.id === s.patternId);
        return p ? this.isNightShift(p) : false;
      }).length;

      return {
        staffId:     member.id!,
        staffName:   member.name,
        workDays,
        restDays,
        akeDays,
        vacationDays,
        nightDays,
        totalDays:   mine.length,
      };
    });

    const shiftTypeDistribution: Record<string, number> = {};
    for (const s of schedule) {
      const p = patterns.find(x => x.id === s.patternId);
      if (p) shiftTypeDistribution[p.name] = (shiftTypeDistribution[p.name] ?? 0) + 1;
    }

    return {
      totalDays:            dates.length,
      totalShifts:          schedule.length,
      staffWorkload,
      shiftTypeDistribution,
    };
  }

  // ─────────────────────────────────────────
  // 夜勤判定
  // ─────────────────────────────────────────
  private isNightShift(p: ShiftPattern): boolean {
    if (p.isNight === true) return true;
    const n = p.name ?? '';
    return n.includes('夜勤') || n.includes('夜') || n === '深夜';
  }
}
