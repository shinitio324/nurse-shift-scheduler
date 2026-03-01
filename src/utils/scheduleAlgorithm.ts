// src/utils/scheduleAlgorithm.ts
import {
  Staff,
  ShiftPattern,
  ScheduleConstraints,
  ShiftRequest,
  GeneratedSchedule,
  ScheduleGenerationParams,
  ScheduleGenerationResult,
  ScheduleStatistics,
  ConstraintViolation,
} from '../types';

export class ScheduleGenerator {
  private staff: Staff[];
  private patterns: ShiftPattern[];        // 勤務パターンのみ（isWorkday=true）
  private allPatterns: ShiftPattern[];     // 全パターン（明け・有給・休み含む）
  private constraints: ScheduleConstraints[];
  private requests: ShiftRequest[];
  private params: ScheduleGenerationParams;

  private schedules: GeneratedSchedule[] = [];
  private violations: ConstraintViolation[] = [];

  // シフト名定数（DB パターンの name に依存）
  private readonly AKE_NAME      = '明け';
  private readonly VACATION_NAME = '有給';
  private readonly REST_NAME     = '休み';

  constructor(
    staff: Staff[],
    patterns: ShiftPattern[],
    constraints: ScheduleConstraints[],
    requests: ShiftRequest[],
    params: ScheduleGenerationParams
  ) {
    this.staff       = staff;
    this.allPatterns = patterns;
    this.patterns    = patterns.filter(p => p.isWorkday === true);
    this.constraints = constraints
      .filter(c => c.isActive && params.constraintIds.includes(c.id))
      .sort((a, b) => b.priority - a.priority);
    this.requests = requests;
    this.params   = params;
  }

  // ================================================================
  // public: メインエントリ
  // ================================================================
  public generate(): ScheduleGenerationResult {
    this.schedules = [];
    this.violations = [];

    const daysInMonth = this.getDaysInMonth(this.params.targetYear, this.params.targetMonth);

    // ── Pass 1: 有給希望を先に確定（強制割り当て） ──────────────────
    this.applyVacationRequests();

    // ── Pass 2: 各日ごとに通常シフトを割り当て ──────────────────────
    for (let day = 1; day <= daysInMonth; day++) {
      const date = this.formatDate(this.params.targetYear, this.params.targetMonth, day);
      this.generateDaySchedule(date);
    }

    // ── Pass 3: exactRestDaysPerMonth による休み日数の調整 ───────────
    this.adjustRestDays();

    console.log('✅ 生成完了:', this.schedules.length, '件 / 違反:', this.violations.length, '件');

    return {
      schedules:   this.schedules,
      statistics:  this.calculateStatistics(),
      violations:  this.violations,
      generatedAt: new Date(),
    };
  }

  // ================================================================
  // Pass 1: 有給希望を強制確定
  // ================================================================
  private applyVacationRequests(): void {
    const vacationRequests = this.requests.filter(r =>
      r.shiftType === this.VACATION_NAME ||
      this.allPatterns.find(p => p.name === r.shiftType)?.isVacation
    );

    for (const req of vacationRequests) {
      const staff = this.staff.find(s => s.id === req.staffId);
      if (!staff) continue;

      // 既に有給が入っていればスキップ
      if (this.schedules.some(s => s.staffId === req.staffId && s.date === req.date)) continue;

      this.schedules.push(this.makeSchedule(req.staffId, staff.name, req.date, this.VACATION_NAME));
      console.log(`📋 有給確定: ${staff.name} ${req.date}`);
    }
  }

  // ================================================================
  // Pass 2: 1日分のスケジュール生成
  // ================================================================
  private generateDaySchedule(date: string): void {
    const dayRequests = this.requests.filter(r =>
      r.date === date &&
      r.shiftType !== this.VACATION_NAME &&
      !this.allPatterns.find(p => p.name === r.shiftType)?.isVacation
    );

    for (const pattern of this.patterns) {
      const requiredStaff = pattern.requiredStaff;
      const assignedStaff: string[] = [];

      // 1. シフト希望を優先
      if (this.params.prioritizeRequests) {
        const requestedIds = dayRequests
          .filter(r => r.shiftType === pattern.name)
          .map(r => r.staffId);

        for (const staffId of requestedIds) {
          if (assignedStaff.length >= requiredStaff) break;
          if (this.canAssignStaff(staffId, date, pattern)) {
            assignedStaff.push(staffId);
          }
        }
      }

      // 2. 不足分を自動割り当て
      const remaining = this.staff
        .map(s => s.id)
        .filter(id => !assignedStaff.includes(id));

      const sorted = this.sortStaffByWorkload(remaining);

      for (const staffId of sorted) {
        if (assignedStaff.length >= requiredStaff) break;
        if (this.canAssignStaff(staffId, date, pattern)) {
          assignedStaff.push(staffId);
        }
      }

      for (const staffId of assignedStaff) {
        const s = this.staff.find(x => x.id === staffId)!;
        this.schedules.push(this.makeSchedule(staffId, s.name, date, pattern.name));
      }

      if (assignedStaff.length < requiredStaff) {
        this.violations.push({
          date, staffId: '', staffName: '',
          constraintName: '必要人数',
          violationType: 'required_staff',
          severity: 'error',
          message: `${pattern.name} 必要${requiredStaff}名 → ${assignedStaff.length}名しか割り当て不可`,
        });
      }
    }

    // ── 夜勤翌日に「明け」を自動割り当て ──
    this.applyAkeForDate(date);

    // ── その日にシフトのないスタッフを「休み」に ──
    const assignedIds = this.schedules.filter(s => s.date === date).map(s => s.staffId);
    for (const st of this.staff) {
      if (!assignedIds.includes(st.id)) {
        this.schedules.push(this.makeSchedule(st.id, st.name, date, this.REST_NAME));
      }
    }
  }

  // ================================================================
  // 夜勤翌日に「明け」を自動割り当て
  // ================================================================
  private applyAkeForDate(date: string): void {
    // nightShiftNextDayOff が有効な制約があるか確認
    const hasAkeConstraint = this.constraints.some(c => c.nightShiftNextDayOff);
    if (!hasAkeConstraint) return;

    const prevDate = this.getPrevDate(date);

    for (const st of this.staff) {
      // すでにこの日に割り当て済みならスキップ
      if (this.schedules.some(s => s.staffId === st.id && s.date === date)) continue;

      // 前日が夜勤か確認
      const prevSchedule = this.schedules.find(
        s => s.staffId === st.id && s.date === prevDate
      );
      if (prevSchedule && this.isNightShift(prevSchedule.shiftType)) {
        // 「明け」を割り当て
        this.schedules.push(this.makeSchedule(st.id, st.name, date, this.AKE_NAME));
        console.log(`🌅 明け自動割当: ${st.name} ${date}`);
      }
    }
  }

  // ================================================================
  // Pass 3: exactRestDaysPerMonth に基づき休み日数を調整
  // ================================================================
  private adjustRestDays(): void {
    if (this.constraints.length === 0) return;

    // 最高優先度の制約の exactRestDaysPerMonth を使用
    const constraint = this.constraints[0];
    const targetRestDays = constraint.exactRestDaysPerMonth;
    if (!targetRestDays || targetRestDays <= 0) return;

    const daysInMonth = this.getDaysInMonth(this.params.targetYear, this.params.targetMonth);

    for (const st of this.staff) {
      const staffSchedules = this.schedules.filter(s => s.staffId === st.id);

      // 純休み（明け・有給を除いた休み）を数える
      const currentRestDays = this.countPureRestDays(st.id);
      const diff = targetRestDays - currentRestDays;

      if (diff > 0) {
        // 休みが足りない → 勤務日を休みに変換（優先度：勤務時間の多い日から）
        this.addRestDays(st.id, st.name, diff);
      } else if (diff < 0) {
        // 休みが多すぎる → 休みを勤務に変換（優先度：必要人数が不足している日から）
        this.removeRestDays(st.id, Math.abs(diff));
      }
    }
  }

  /** 純休み日数カウント（明け・有給を除く） */
  private countPureRestDays(staffId: string): number {
    return this.schedules.filter(s =>
      s.staffId === staffId &&
      this.isPureRest(s.shiftType)
    ).length;
  }

  /** 「純休み」判定（明け・有給は除く） */
  private isPureRest(shiftType: string): boolean {
    if (shiftType !== this.REST_NAME) return false;
    return true;
  }

  /** 休みを追加（勤務日を休みに変換） */
  private addRestDays(staffId: string, staffName: string, count: number): void {
    // 変換候補：非夜勤の勤務日を優先度低い順（連続勤務を避けるため月末から）
    const workSchedules = this.schedules
      .filter(s =>
        s.staffId === staffId &&
        s.shiftType !== this.REST_NAME &&
        s.shiftType !== this.AKE_NAME &&
        s.shiftType !== this.VACATION_NAME &&
        !this.isNightShift(s.shiftType)
      )
      .sort((a, b) => b.date.localeCompare(a.date)); // 月末から変換

    let converted = 0;
    for (const sch of workSchedules) {
      if (converted >= count) break;
      // その日の前後が夜勤/明けでない場合のみ変換
      const nextDate = this.getNextDate(sch.date);
      const prevDate = this.getPrevDate(sch.date);
      const prevSch = this.schedules.find(s => s.staffId === staffId && s.date === prevDate);
      const nextSch = this.schedules.find(s => s.staffId === staffId && s.date === nextDate);
      if (prevSch && this.isNightShift(prevSch.shiftType)) continue; // 前日夜勤 → 明けのはず
      if (nextSch && nextSch.shiftType === this.AKE_NAME) continue;  // 翌日明け → 変換不可

      sch.shiftType = this.REST_NAME;
      converted++;
      console.log(`📅 休み追加変換: ${staffName} ${sch.date} → 休み`);
    }
  }

  /** 休みを削除（休み日を勤務に変換） */
  private removeRestDays(staffId: string, count: number): void {
    // 変換候補：必要人数が不足している日の休みを優先
    const restSchedules = this.schedules
      .filter(s =>
        s.staffId === staffId &&
        s.shiftType === this.REST_NAME
      )
      .sort((a, b) => a.date.localeCompare(b.date)); // 月初から変換

    let converted = 0;
    for (const sch of restSchedules) {
      if (converted >= count) break;

      // 連続勤務チェック（変換後に maxConsecutiveWorkDays を超えないか）
      const consecutive = this.getConsecutiveWorkDays(staffId, sch.date);
      const maxConsec = this.constraints[0]?.maxConsecutiveWorkDays ?? 99;
      if (consecutive >= maxConsec) continue;

      // 前後が明けでないか確認
      const prevDate = this.getPrevDate(sch.date);
      const prevSch = this.schedules.find(s => s.staffId === staffId && s.date === prevDate);
      if (prevSch && this.isNightShift(prevSch.shiftType)) continue;
      if (sch.shiftType === this.AKE_NAME) continue;

      // もっとも必要人数が不足しているパターンに変換
      const bestPattern = this.findUnderStaffedPattern(sch.date);
      if (bestPattern) {
        sch.shiftType = bestPattern.name;
        converted++;
        console.log(`📅 休み削除変換: ${sch.date} → ${bestPattern.name}`);
      }
    }
  }

  /** その日に必要人数が不足しているパターンを返す */
  private findUnderStaffedPattern(date: string): ShiftPattern | null {
    for (const pattern of this.patterns) {
      if (pattern.name === this.REST_NAME) continue;
      const assigned = this.schedules.filter(
        s => s.date === date && s.shiftType === pattern.name
      ).length;
      if (assigned < pattern.requiredStaff) return pattern;
    }
    return null;
  }

  // ================================================================
  // 割り当て可否判定
  // ================================================================
  private canAssignStaff(staffId: string, date: string, pattern: ShiftPattern): boolean {
    // すでに割り当て済み（有給・明け含む）
    if (this.schedules.some(s => s.staffId === staffId && s.date === date)) return false;

    for (const constraint of this.constraints) {
      if (!this.checkConstraint(staffId, date, pattern, constraint)) return false;
    }
    return true;
  }

  // ================================================================
  // 制約チェック
  // ================================================================
  private checkConstraint(
    staffId: string,
    date: string,
    pattern: ShiftPattern,
    constraint: ScheduleConstraints
  ): boolean {
    const staffSchedules = this.schedules.filter(s => s.staffId === staffId);

    // 1. 連続勤務日数
    const consecutiveWork = this.getConsecutiveWorkDays(staffId, date);
    if (consecutiveWork >= constraint.maxConsecutiveWorkDays) return false;

    // 2. 夜勤翌日は「明け」（勤務パターンの割り当て不可）
    if (constraint.nightShiftNextDayOff) {
      const prevDate    = this.getPrevDate(date);
      const prevSchedule = staffSchedules.find(s => s.date === prevDate);
      if (prevSchedule && this.isNightShift(prevSchedule.shiftType)) {
        return false; // 明けとして後で自動割り当てされる
      }
    }

    // 3. 連続夜勤
    if (this.isNightShift(pattern.name)) {
      if (this.getConsecutiveNightShifts(staffId, date) >= constraint.maxConsecutiveNightShifts) {
        return false;
      }
    }

    // 4. 月間夜勤回数
    if (this.isNightShift(pattern.name)) {
      const monthNight = staffSchedules.filter(s => this.isNightShift(s.shiftType)).length;
      if (monthNight >= constraint.maxNightShiftsPerMonth) return false;
    }

    // 5. 週間夜勤回数
    if (this.isNightShift(pattern.name)) {
      if (this.getWeekNightShifts(staffId, date) >= constraint.maxNightShiftsPerWeek) return false;
    }

    // 6. 月間勤務時間
    if (pattern.isWorkday) {
      const addH = this.getPatternHours(pattern);
      if (this.getMonthWorkHours(staffId) + addH > constraint.maxWorkHoursPerMonth) return false;
    }

    // 7. 週間勤務時間
    if (pattern.isWorkday) {
      const addH = this.getPatternHours(pattern);
      if (this.getWeekWorkHours(staffId, date) + addH > constraint.maxWorkHoursPerWeek) return false;
    }

    return true;
  }

  // ================================================================
  // ヘルパー
  // ================================================================

  private makeSchedule(
    staffId: string, staffName: string, date: string, shiftType: string
  ): GeneratedSchedule {
    return {
      id: crypto.randomUUID(),
      date,
      staffId,
      staffName,
      shiftType,
      isManuallyAdjusted: false,
      constraintViolations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private isNightShift(shiftType: string): boolean {
    if (shiftType === this.AKE_NAME) return false;
    return shiftType.includes('夜勤') || shiftType.includes('夜');
  }

  private isAkeShift(shiftType: string): boolean {
    const p = this.allPatterns.find(x => x.name === shiftType);
    return p?.isAke === true || shiftType === this.AKE_NAME;
  }

  private isVacationShift(shiftType: string): boolean {
    const p = this.allPatterns.find(x => x.name === shiftType);
    return p?.isVacation === true || shiftType === this.VACATION_NAME;
  }

  private getPrevDate(date: string): string {
    const d = new Date(date); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  private getNextDate(date: string): string {
    const d = new Date(date); d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  private getWeekRange(date: string): { start: string; end: string } {
    const d   = new Date(date);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return {
      start: monday.toISOString().split('T')[0],
      end:   nextMonday.toISOString().split('T')[0],
    };
  }

  private getConsecutiveWorkDays(staffId: string, currentDate: string): number {
    let count = 0;
    let d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    while (true) {
      const ds  = d.toISOString().split('T')[0];
      const sch = this.schedules.find(s => s.staffId === staffId && s.date === ds);
      if (!sch || sch.shiftType === this.REST_NAME || this.isAkeShift(sch.shiftType)) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  private getConsecutiveNightShifts(staffId: string, currentDate: string): number {
    let count = 0;
    let d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    while (true) {
      const ds  = d.toISOString().split('T')[0];
      const sch = this.schedules.find(s => s.staffId === staffId && s.date === ds);
      if (!sch || !this.isNightShift(sch.shiftType)) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  private getWeekNightShifts(staffId: string, currentDate: string): number {
    const { start, end } = this.getWeekRange(currentDate);
    return this.schedules.filter(s =>
      s.staffId === staffId && s.date >= start && s.date < end &&
      this.isNightShift(s.shiftType)
    ).length;
  }

  private getWeekWorkHours(staffId: string, currentDate: string): number {
    const { start, end } = this.getWeekRange(currentDate);
    return this.schedules
      .filter(s => s.staffId === staffId && s.date >= start && s.date < end && s.shiftType !== this.REST_NAME)
      .reduce((sum, s) => {
        const p = this.allPatterns.find(x => x.name === s.shiftType);
        return sum + (p ? this.getPatternHours(p) : 0);
      }, 0);
  }

  private getMonthWorkHours(staffId: string): number {
    return this.schedules
      .filter(s => s.staffId === staffId && s.shiftType !== this.REST_NAME)
      .reduce((sum, s) => {
        const p = this.allPatterns.find(x => x.name === s.shiftType);
        return sum + (p ? this.getPatternHours(p) : 0);
      }, 0);
  }

  private getPatternHours(pattern: ShiftPattern): number {
    if (!pattern.startTime || !pattern.endTime) return 0;
    const [sh, sm] = pattern.startTime.split(':').map(Number);
    const [eh, em] = pattern.endTime.split(':').map(Number);
    let minutes = (eh * 60 + em) - (sh * 60 + sm);
    if (minutes < 0) minutes += 24 * 60;
    return minutes / 60;
  }

  private sortStaffByWorkload(staffIds: string[]): string[] {
    return [...staffIds].sort((a, b) => {
      const aW = this.schedules.filter(s => s.staffId === a && s.shiftType !== this.REST_NAME && !this.isAkeShift(s.shiftType)).length;
      const bW = this.schedules.filter(s => s.staffId === b && s.shiftType !== this.REST_NAME && !this.isAkeShift(s.shiftType)).length;
      return aW - bW;
    });
  }

  private getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  private formatDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // ================================================================
  // 統計計算
  // ================================================================
  private calculateStatistics(): ScheduleStatistics {
    const daysInMonth = this.getDaysInMonth(this.params.targetYear, this.params.targetMonth);

    const staffWorkload = this.staff.map(s => {
      const ss = this.schedules.filter(x => x.staffId === s.id);
      return {
        staffId:   s.id,
        staffName: s.name,
        totalShifts:         ss.filter(x => x.shiftType !== this.REST_NAME && !this.isAkeShift(x.shiftType) && !this.isVacationShift(x.shiftType)).length,
        nightShifts:         ss.filter(x => this.isNightShift(x.shiftType)).length,
        restDays:            ss.filter(x => this.isPureRest(x.shiftType)).length,
        akeDays:             ss.filter(x => this.isAkeShift(x.shiftType)).length,
        vacationDays:        ss.filter(x => this.isVacationShift(x.shiftType)).length,
        consecutiveWorkDays: this.getMaxConsecutiveWorkDays(s.id),
        totalWorkHours:      this.calcTotalWorkHours(s.id),
      };
    });

    const shiftTypeDistribution = this.allPatterns.map(p => {
      const count = this.schedules.filter(s => s.shiftType === p.name).length;
      return {
        shiftType:     p.name,
        count,
        requiredStaff: p.requiredStaff,
        actualStaff:   Math.round((count / daysInMonth) * 10) / 10,
      };
    });

    return {
      totalDays:   daysInMonth,
      totalShifts: this.schedules.filter(s => s.shiftType !== this.REST_NAME).length,
      staffWorkload,
      shiftTypeDistribution,
    };
  }

  private getMaxConsecutiveWorkDays(staffId: string): number {
    const sorted = this.schedules
      .filter(s => s.staffId === staffId)
      .sort((a, b) => a.date.localeCompare(b.date));

    let max = 0, cur = 0;
    for (const s of sorted) {
      if (s.shiftType !== this.REST_NAME && !this.isAkeShift(s.shiftType)) {
        cur++; max = Math.max(max, cur);
      } else { cur = 0; }
    }
    return max;
  }

  private calcTotalWorkHours(staffId: string): number {
    return Math.round(
      this.schedules
        .filter(s => s.staffId === staffId && s.shiftType !== this.REST_NAME && !this.isAkeShift(s.shiftType))
        .reduce((sum, s) => {
          const p = this.allPatterns.find(x => x.name === s.shiftType);
          return sum + (p ? this.getPatternHours(p) : 0);
        }, 0) * 10
    ) / 10;
  }
}
