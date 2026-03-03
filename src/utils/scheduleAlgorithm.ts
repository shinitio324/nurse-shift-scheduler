// src/utils/scheduleAlgorithm.ts  ★ 明けバグ修正版
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
  private patterns: ShiftPattern[];    // isWorkday=true のみ
  private allPatterns: ShiftPattern[];
  private constraints: ScheduleConstraints[];
  private requests: ShiftRequest[];
  private params: ScheduleGenerationParams;

  private schedules: GeneratedSchedule[] = [];
  private violations: ConstraintViolation[] = [];

  private readonly AKE_NAME      = '明け';
  private readonly VACATION_NAME = '有給';
  private readonly REST_NAME     = '休み';

  // ★ 修正: コンストラクタで「明けパターン存在フラグ」をキャッシュ
  private readonly hasAkePattern: boolean;

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

    // ★ 修正: 「明け」パターンの有無を起動時に確定
    //   DBに「明け」パターンが存在する = 夜勤翌日は必ず「明け」を使う
    this.hasAkePattern = patterns.some(
      p => p.isAke === true || p.name === this.AKE_NAME
    );
    console.log('🌅 明けパターン存在:', this.hasAkePattern);
    console.log('⚖️ 適用制約数:', this.constraints.length);
  }

  // ================================================================
  // メインエントリ
  // ================================================================
  public generate(): ScheduleGenerationResult {
    this.schedules = [];
    this.violations = [];

    const daysInMonth = this.getDaysInMonth(this.params.targetYear, this.params.targetMonth);

    // Pass 1: 有給希望を先に確定
    this.applyVacationRequests();

    // Pass 2: 日ごとに通常シフト割り当て
    for (let day = 1; day <= daysInMonth; day++) {
      const date = this.formatDate(this.params.targetYear, this.params.targetMonth, day);
      this.generateDaySchedule(date);
    }

    // Pass 3: exactRestDaysPerMonth による休み日数調整
    this.adjustRestDays();

    // Pass 4: スタッフ別 minWorkDaysPerMonth の保証
    this.enforceMinWorkDays();

    console.log('✅ 生成完了:', this.schedules.length, '件 / 違反:', this.violations.length, '件');

    return {
      schedules:   this.schedules,
      statistics:  this.calculateStatistics(),
      violations:  this.violations,
      generatedAt: new Date(),
    };
  }

  // ================================================================
  // Pass 1: 有給希望の強制確定
  // ================================================================
  private applyVacationRequests(): void {
    const vacReqs = this.requests.filter(r =>
      r.shiftType === this.VACATION_NAME ||
      this.allPatterns.find(p => p.name === r.shiftType)?.isVacation
    );
    for (const req of vacReqs) {
      const s = this.staff.find(x => x.id === req.staffId);
      if (!s) continue;
      if (this.schedules.some(x => x.staffId === req.staffId && x.date === req.date)) continue;
      this.schedules.push(this.makeSchedule(req.staffId, s.name, req.date, this.VACATION_NAME));
      console.log(`📋 有給確定: ${s.name} ${req.date}`);
    }
  }

  // ================================================================
  // Pass 2: 1日分のシフト割り当て
  // ================================================================
  private generateDaySchedule(date: string): void {
    const dayRequests = this.requests.filter(r =>
      r.date === date &&
      r.shiftType !== this.VACATION_NAME &&
      !this.allPatterns.find(p => p.name === r.shiftType)?.isVacation
    );

    for (const pattern of this.patterns) {
      const required = pattern.requiredStaff;
      const assigned: string[] = [];

      // 1. シフト希望優先
      if (this.params.prioritizeRequests) {
        for (const req of dayRequests.filter(r => r.shiftType === pattern.name)) {
          if (assigned.length >= required) break;
          if (this.canAssignStaff(req.staffId, date, pattern)) assigned.push(req.staffId);
        }
      }

      // 2. 不足分を自動補充（minWorkDays 充足率の低いスタッフを優先）
      const remaining = this.staff.map(s => s.id).filter(id => !assigned.includes(id));
      const sorted = this.sortStaffByPriority(remaining, date);

      for (const staffId of sorted) {
        if (assigned.length >= required) break;
        if (this.canAssignStaff(staffId, date, pattern)) assigned.push(staffId);
      }

      for (const staffId of assigned) {
        const s = this.staff.find(x => x.id === staffId)!;
        this.schedules.push(this.makeSchedule(staffId, s.name, date, pattern.name));
      }

      if (assigned.length < required) {
        this.violations.push({
          date, staffId: '', staffName: '',
          constraintName: '必要人数',
          violationType: 'required_staff',
          severity: 'error',
          message: `${pattern.name} 必要${required}名 → ${assigned.length}名しか割り当て不可`,
        });
      }
    }

    // ★ 修正済み: 夜勤翌日「明け」自動割り当て
    this.applyAkeForDate(date);

    // 残スタッフを「休み」に
    const assignedIds = this.schedules.filter(s => s.date === date).map(s => s.staffId);
    for (const st of this.staff) {
      if (!assignedIds.includes(st.id)) {
        this.schedules.push(this.makeSchedule(st.id, st.name, date, this.REST_NAME));
      }
    }
  }

  // ================================================================
  // ★ 修正: 夜勤翌日「明け」自動割り当て
  //   制約の ON/OFF に依存せず、「明け」パターンが DB に存在すれば常に動作
  // ================================================================
  private applyAkeForDate(date: string): void {
    // 「明け」パターンが存在しない場合のみスキップ
    if (!this.hasAkePattern) {
      return;
    }

    const prev = this.getPrevDate(date);

    for (const st of this.staff) {
      // その日にすでに何らかのシフトが割り当て済みならスキップ
      if (this.schedules.some(s => s.staffId === st.id && s.date === date)) continue;

      // 前日のシフトを取得
      const prevSch = this.schedules.find(s => s.staffId === st.id && s.date === prev);

      // 前日が夜勤 → 今日を「明け」に
      if (prevSch && this.isNightShift(prevSch.shiftType)) {
        this.schedules.push(this.makeSchedule(st.id, st.name, date, this.AKE_NAME));
        console.log(`🌅 明け自動割当: ${st.name} ${date}（前日 ${prev} が ${prevSch.shiftType}）`);
      }
    }
  }

  // ================================================================
  // Pass 3: exactRestDaysPerMonth による休み日数調整
  // ================================================================
  private adjustRestDays(): void {
    if (!this.constraints.length) return;
    const targetRest = this.constraints[0].exactRestDaysPerMonth;
    if (!targetRest || targetRest <= 0) return;

    for (const st of this.staff) {
      const cur  = this.countPureRestDays(st.id);
      const diff = targetRest - cur;
      if (diff > 0)      this.addRestDays(st.id, st.name, diff);
      else if (diff < 0) this.removeRestDays(st.id, Math.abs(diff));
    }
  }

  // ================================================================
  // Pass 4: スタッフ別 minWorkDaysPerMonth の保証
  // ================================================================
  private enforceMinWorkDays(): void {
    for (const st of this.staff) {
      const target = st.minWorkDaysPerMonth ?? 0;
      if (target <= 0) continue;

      const current = this.countWorkDays(st.id);
      const deficit = target - current;
      if (deficit <= 0) continue;

      console.log(`🔧 ${st.name}: 目標${target}日 / 現在${current}日 → ${deficit}日不足`);

      const converted = this.promoteRestToWork(st.id, st.name, deficit);

      if (converted < deficit) {
        this.violations.push({
          date: '',
          staffId: st.id,
          staffName: st.name,
          constraintName: '最低勤務日数',
          violationType: 'min_work_days',
          severity: 'warning',
          message: `${st.name}: 月最低勤務日数 ${target}日 に対し ${current + converted}日しか確保できませんでした`,
        });
      }
    }
  }

  // ================================================================
  // 割り当て可否
  // ================================================================
  private canAssignStaff(staffId: string, date: string, pattern: ShiftPattern): boolean {
    // その日すでに割り当て済み
    if (this.schedules.some(s => s.staffId === staffId && s.date === date)) return false;

    for (const c of this.constraints) {
      if (!this.checkConstraint(staffId, date, pattern, c)) return false;
    }

    // ★ 修正: 制約が0件でも「明けパターン存在」なら夜勤翌日はブロック
    if (this.constraints.length === 0 && this.hasAkePattern) {
      if (this.isNightShiftNextDay(staffId, date)) return false;
    }

    return true;
  }

  // ================================================================
  // 制約チェック
  // ================================================================
  private checkConstraint(
    staffId: string, date: string, pattern: ShiftPattern, c: ScheduleConstraints
  ): boolean {
    const ss = this.schedules.filter(s => s.staffId === staffId);

    // 1. 連続勤務日数
    if (this.getConsecutiveWorkDays(staffId, date) >= c.maxConsecutiveWorkDays) return false;

    // 2. ★ 修正: 夜勤翌日に勤務不可
    //    「明けパターン存在」OR「制約のnightShiftNextDayOff=true」のどちらかで発動
    if (this.hasAkePattern || c.nightShiftNextDayOff) {
      if (this.isNightShiftNextDay(staffId, date)) return false;
    }

    // 3. 連続夜勤
    if (this.isNightShift(pattern.name) &&
        this.getConsecutiveNightShifts(staffId, date) >= c.maxConsecutiveNightShifts) return false;

    // 4. 月間夜勤回数
    if (this.isNightShift(pattern.name) &&
        ss.filter(s => this.isNightShift(s.shiftType)).length >= c.maxNightShiftsPerMonth) return false;

    // 5. 週間夜勤回数
    if (this.isNightShift(pattern.name) &&
        this.getWeekNightShifts(staffId, date) >= c.maxNightShiftsPerWeek) return false;

    // 6. 月間勤務時間
    if (pattern.isWorkday) {
      if (this.getMonthWorkHours(staffId) + this.getPatternHours(pattern) > c.maxWorkHoursPerMonth) return false;
    }

    // 7. 週間勤務時間
    if (pattern.isWorkday) {
      if (this.getWeekWorkHours(staffId, date) + this.getPatternHours(pattern) > c.maxWorkHoursPerWeek) return false;
    }

    return true;
  }

  // ★ 修正: 「前日が夜勤かどうか」を独立メソッドに切り出し
  private isNightShiftNextDay(staffId: string, date: string): boolean {
    const prevSch = this.schedules.find(
      s => s.staffId === staffId && s.date === this.getPrevDate(date)
    );
    return !!(prevSch && this.isNightShift(prevSch.shiftType));
  }

  // ================================================================
  // Pass 3 用ヘルパー
  // ================================================================
  private countPureRestDays(staffId: string): number {
    return this.schedules.filter(s => s.staffId === staffId && s.shiftType === this.REST_NAME).length;
  }

  private addRestDays(staffId: string, _staffName: string, count: number): void {
    const workSchedules = this.schedules
      .filter(s => s.staffId === staffId &&
        s.shiftType !== this.REST_NAME &&
        s.shiftType !== this.AKE_NAME &&
        s.shiftType !== this.VACATION_NAME &&
        !this.isNightShift(s.shiftType))
      .sort((a, b) => b.date.localeCompare(a.date));

    let done = 0;
    for (const sch of workSchedules) {
      if (done >= count) break;
      const prev = this.schedules.find(s => s.staffId === staffId && s.date === this.getPrevDate(sch.date));
      const next = this.schedules.find(s => s.staffId === staffId && s.date === this.getNextDate(sch.date));
      if (prev && this.isNightShift(prev.shiftType)) continue;
      if (next && this.isAkeShift(next.shiftType)) continue;
      sch.shiftType = this.REST_NAME;
      done++;
    }
  }

  private removeRestDays(staffId: string, count: number): void {
    const restSchedules = this.schedules
      .filter(s => s.staffId === staffId && s.shiftType === this.REST_NAME)
      .sort((a, b) => a.date.localeCompare(b.date));

    const maxConsec = this.constraints[0]?.maxConsecutiveWorkDays ?? 99;
    let done = 0;
    for (const sch of restSchedules) {
      if (done >= count) break;
      if (this.getConsecutiveWorkDays(staffId, sch.date) >= maxConsec) continue;
      const best = this.findUnderStaffedPattern(sch.date);
      if (best) { sch.shiftType = best.name; done++; }
    }
  }

  private findUnderStaffedPattern(date: string): ShiftPattern | null {
    for (const p of this.patterns) {
      const assigned = this.schedules.filter(s => s.date === date && s.shiftType === p.name).length;
      if (assigned < p.requiredStaff) return p;
    }
    return null;
  }

  // ================================================================
  // Pass 4 用ヘルパー
  // ================================================================
  private countWorkDays(staffId: string): number {
    return this.schedules.filter(s =>
      s.staffId === staffId &&
      s.shiftType !== this.REST_NAME &&
      !this.isAkeShift(s.shiftType) &&
      !this.isVacationShift(s.shiftType)
    ).length;
  }

  private promoteRestToWork(staffId: string, staffName: string, needed: number): number {
    const restSchedules = this.schedules
      .filter(s => s.staffId === staffId && s.shiftType === this.REST_NAME)
      .sort((a, b) => a.date.localeCompare(b.date));

    let converted = 0;
    const maxConsec = this.constraints[0]?.maxConsecutiveWorkDays ?? 99;

    for (const sch of restSchedules) {
      if (converted >= needed) break;
      if (this.getConsecutiveWorkDays(staffId, sch.date) >= maxConsec) continue;

      const prevSch = this.schedules.find(s => s.staffId === staffId && s.date === this.getPrevDate(sch.date));
      if (prevSch && this.isNightShift(prevSch.shiftType)) continue;

      const nextSch = this.schedules.find(s => s.staffId === staffId && s.date === this.getNextDate(sch.date));
      if (nextSch && this.isAkeShift(nextSch.shiftType)) continue;

      const bestPattern = this.findBestPatternForPromotion(sch.date);
      if (!bestPattern) continue;

      if (this.constraints.length > 0 &&
          !this.checkConstraint(staffId, sch.date, bestPattern, this.constraints[0])) continue;

      sch.shiftType = bestPattern.name;
      converted++;
      console.log(`⬆️ ${staffName} ${sch.date}: 休み → ${bestPattern.name}（最低勤務日数補完）`);
    }
    return converted;
  }

  private findBestPatternForPromotion(date: string): ShiftPattern | null {
    for (const p of this.patterns) {
      if (this.isNightShift(p.name)) continue;
      const assigned = this.schedules.filter(s => s.date === date && s.shiftType === p.name).length;
      if (assigned < p.requiredStaff) return p;
    }
    const dayShift = this.patterns.find(p => p.name.includes('日') && !this.isNightShift(p.name));
    return dayShift ?? this.patterns[0] ?? null;
  }

  // ================================================================
  // ソート: minWorkDaysPerMonth 充足率を考慮
  // ================================================================
  private sortStaffByPriority(staffIds: string[], _date: string): string[] {
    return [...staffIds].sort((a, b) => {
      const sA = this.staff.find(s => s.id === a);
      const sB = this.staff.find(s => s.id === b);
      const targetA = sA?.minWorkDaysPerMonth ?? 0;
      const targetB = sB?.minWorkDaysPerMonth ?? 0;
      const workA = this.countWorkDays(a);
      const workB = this.countWorkDays(b);

      if (targetA > 0 && targetB > 0) {
        const rA = workA / targetA;
        const rB = workB / targetB;
        if (rA !== rB) return rA - rB;
      } else if (targetA > 0 && workA / targetA < 1) {
        return -1;
      } else if (targetB > 0 && workB / targetB < 1) {
        return 1;
      }
      return workA - workB;
    });
  }

  // ================================================================
  // ヘルパー
  // ================================================================
  private makeSchedule(staffId: string, staffName: string, date: string, shiftType: string): GeneratedSchedule {
    return {
      id: crypto.randomUUID(), date, staffId, staffName, shiftType,
      isManuallyAdjusted: false, constraintViolations: [],
      createdAt: new Date(), updatedAt: new Date(),
    };
  }

  private isNightShift(t: string): boolean {
    if (t === this.AKE_NAME) return false;
    return t.includes('夜勤') || t.includes('夜');
  }

  private isAkeShift(t: string): boolean {
    const p = this.allPatterns.find(x => x.name === t);
    return p?.isAke === true || t === this.AKE_NAME;
  }

  private isVacationShift(t: string): boolean {
    const p = this.allPatterns.find(x => x.name === t);
    return p?.isVacation === true || t === this.VACATION_NAME;
  }

  private getPrevDate(d: string): string {
    const x = new Date(d); x.setDate(x.getDate() - 1);
    return x.toISOString().split('T')[0];
  }

  private getNextDate(d: string): string {
    const x = new Date(d); x.setDate(x.getDate() + 1);
    return x.toISOString().split('T')[0];
  }

  private getWeekRange(date: string): { start: string; end: string } {
    const d   = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon  = new Date(d); mon.setDate(d.getDate() + diff);
    const next = new Date(mon); next.setDate(mon.getDate() + 7);
    return { start: mon.toISOString().split('T')[0], end: next.toISOString().split('T')[0] };
  }

  private getConsecutiveWorkDays(staffId: string, currentDate: string): number {
    let count = 0;
    let d = new Date(currentDate); d.setDate(d.getDate() - 1);
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
    let d = new Date(currentDate); d.setDate(d.getDate() - 1);
    while (true) {
      const ds  = d.toISOString().split('T')[0];
      const sch = this.schedules.find(s => s.staffId === staffId && s.date === ds);
      if (!sch || !this.isNightShift(sch.shiftType)) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  private getWeekNightShifts(staffId: string, date: string): number {
    const { start, end } = this.getWeekRange(date);
    return this.schedules.filter(s =>
      s.staffId === staffId && s.date >= start && s.date < end && this.isNightShift(s.shiftType)
    ).length;
  }

  private getWeekWorkHours(staffId: string, date: string): number {
    const { start, end } = this.getWeekRange(date);
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

  private getPatternHours(p: ShiftPattern): number {
    if (!p.startTime || !p.endTime) return 0;
    const [sh, sm] = p.startTime.split(':').map(Number);
    const [eh, em] = p.endTime.split(':').map(Number);
    let m = (eh * 60 + em) - (sh * 60 + sm);
    if (m < 0) m += 1440;
    return m / 60;
  }

  private getDaysInMonth(y: number, m: number): number {
    return new Date(y, m, 0).getDate();
  }

  private formatDate(y: number, m: number, d: number): string {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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
        restDays:            ss.filter(x => x.shiftType === this.REST_NAME).length,
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
      } else {
        cur = 0;
      }
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
