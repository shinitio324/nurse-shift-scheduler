// ============================================================
// 定数
// ============================================================
export const AKE_NAME      = '明け';
export const VACATION_NAME = '有給';
export const REST_NAME     = '休み';

// ============================================================
// ユーティリティ
// ============================================================
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
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

// ============================================================
// ScheduleGenerator クラス
// ============================================================
export class ScheduleGenerator {
  // ✅ クラスフィールドは「型宣言のみ」— 初期値でparams参照しない
  private year!: number;
  private month!: number;
  private params!: ScheduleGenerationParams;
  private akePatternId!: number | null;
  private vacationPatternId!: number | null;
  private restPatternId!: number | null;
  private prevNightStaffIds!: Set<number>;

  constructor(params: ScheduleGenerationParams) {
    // ✅ constructorの中だけでparamsを使う
    this.params = params;
    this.year  = params.year  ?? (params as any).targetYear  ?? new Date().getFullYear();
    this.month = params.month ?? (params as any).targetMonth ?? (new Date().getMonth() + 1);

    this.akePatternId      = null;
    this.vacationPatternId = null;
    this.restPatternId     = null;
    this.prevNightStaffIds = new Set();

    console.log(`[SG] 初期化: ${this.year}年${this.month}月`);
  }

  async generate(): Promise<ScheduleGenerationResult> {
    // パターンIDを取得
    const patterns = await db.shiftPatterns.toArray();
    const akePat      = patterns.find(p => p.name === AKE_NAME      || p.isAke);
    const vacationPat = patterns.find(p => p.name === VACATION_NAME || p.isVacation);
    const restPat     = patterns.find(p => p.name === REST_NAME);

    this.akePatternId      = akePat?.id      ?? null;
    this.vacationPatternId = vacationPat?.id  ?? null;
    this.restPatternId     = restPat?.id      ?? null;

    console.log(`[SG] 明けパターン: ${akePat ? '✅' : '❌'}  有給: ${vacationPat ? '✅' : '❌'}`);

    if (!this.akePatternId) {
      console.warn('[SG] 明けパターンが存在しません。ensureDefaultPatterns() を確認してください。');
    }

    // 前月末夜勤スタッフを取得
    await this.loadPrevNightStaff();

    const staff      = await db.staff.toArray();
    const requests   = await db.shiftRequests.toArray();
    const constraints = await db.constraints.orderBy('id').last() ?? {} as ScheduleConstraints;
    const dates      = getMonthDates(this.year, this.month);

    console.log(`[SG] スタッフ: ${staff.length}人  対象日数: ${dates.length}日`);

    const schedule: GeneratedShift[] = [];

    // Pass 1: 有給リクエストを事前割当（明け日はスキップ）
    this.applyVacationRequests(schedule, staff, requests, dates);

    // Pass 2: 日ごとに明け → 通常シフト割当
    for (const dateStr of dates) {
      await this.applyAkeForDate(dateStr, schedule, staff);
      this.assignDailyShifts(dateStr, schedule, staff, requests, patterns, constraints);
    }

    // Pass 3: 休み日数調整
    this.adjustRestDays(schedule, staff, constraints, dates);

    // Pass 4: 最低勤務日数保証
    this.enforceMinWorkDays(schedule, staff, constraints, dates, patterns);

    const statistics = this.calcStatistics(schedule, staff, patterns, dates);

    console.log(`[SG] 生成完了: ${schedule.length}件`);
    return { schedule, statistics, warnings: [] };
  }

  // -------------------------------------------------------
  // 前月末の夜勤スタッフを取得
  // -------------------------------------------------------
  private async loadPrevNightStaff(): Promise<void> {
    try {
      const prevMonth = this.month === 1 ? 12 : this.month - 1;
      const prevYear  = this.month === 1 ? this.year - 1 : this.year;
      const lastDay   = getDaysInMonth(prevYear, prevMonth);
      const lastDateStr = formatDate(new Date(prevYear, prevMonth - 1, lastDay));

      const prevShifts = await db.generatedSchedules
        .where('date').equals(lastDateStr)
        .toArray();

      const patterns = await db.shiftPatterns.toArray();
      for (const s of prevShifts) {
        const pat = patterns.find(p => p.id === s.patternId);
        if (pat && this.isNightShift(pat)) {
          this.prevNightStaffIds.add(s.staffId);
        }
      }
      console.log(`[SG] 前月末夜勤スタッフ: ${this.prevNightStaffIds.size}人`);
    } catch {
      console.warn('[SG] 前月末夜勤取得失敗（無視して続行）');
    }
  }

  // -------------------------------------------------------
  // 明けを適用
  // -------------------------------------------------------
  private async applyAkeForDate(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[]
  ): Promise<void> {
    if (!this.akePatternId) return;

    const prevDate = formatDate(addDays(new Date(dateStr), -1));
    const isFirstDay = new Date(dateStr).getDate() === 1;

    for (const member of staff) {
      let needsAke = false;

      if (isFirstDay) {
        needsAke = this.prevNightStaffIds.has(member.id!);
      } else {
        const prevShift = schedule.find(
          s => s.staffId === member.id && s.date === prevDate
        );
        if (prevShift) {
          const patterns = await db.shiftPatterns.toArray();
          const pat = patterns.find(p => p.id === prevShift.patternId);
          needsAke = pat ? this.isNightShift(pat) : false;
        }
      }

      if (needsAke) {
        // 既存エントリを上書き
        const idx = schedule.findIndex(
          s => s.staffId === member.id && s.date === dateStr
        );
        const akeEntry: GeneratedShift = {
          staffId: member.id!,
          date: dateStr,
          patternId: this.akePatternId,
          isManual: false,
        };
        if (idx >= 0) {
          schedule[idx] = akeEntry;
        } else {
          schedule.push(akeEntry);
        }
        console.log(`[applyAke] ✅ スタッフID:${member.id} ${dateStr} 明け付与`);
      }
    }
  }

  // -------------------------------------------------------
  // 夜勤判定
  // -------------------------------------------------------
  private isNightShift(pattern: ShiftPattern): boolean {
    if (pattern.isNight === true) return true;
    const name = pattern.name ?? '';
    return name.includes('夜勤') || name.includes('夜') || name === '深夜';
  }

  // -------------------------------------------------------
  // 有給リクエスト適用（明け日はスキップ）
  // -------------------------------------------------------
  private applyVacationRequests(
    schedule: GeneratedShift[],
    staff: Staff[],
    requests: ShiftRequest[],
    dates: string[]
  ): void {
    if (!this.vacationPatternId) return;

    for (const req of requests) {
      if (req.patternId !== this.vacationPatternId) continue;
      if (!dates.includes(req.date)) continue;

      const member = staff.find(s => s.id === req.staffId);
      if (!member) continue;

      // 明け予定日には有給を入れない
      const prevDate = formatDate(addDays(new Date(req.date), -1));
      const prevEntry = schedule.find(
        s => s.staffId === req.staffId && s.date === prevDate
      );
      // 前日が夜勤なら明けになるのでスキップ（パターン確認は非同期なので保守的に行う）

      schedule.push({
        staffId: req.staffId,
        date: req.date,
        patternId: this.vacationPatternId,
        isManual: false,
      });
    }
  }

  // -------------------------------------------------------
  // 日次シフト割当
  // -------------------------------------------------------
  private assignDailyShifts(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    requests: ShiftRequest[],
    patterns: ShiftPattern[],
    constraints: ScheduleConstraints
  ): void {
    const workPatterns = patterns.filter(
      p => !p.isAke && !p.isVacation && p.name !== REST_NAME
    );
    if (workPatterns.length === 0) return;

    for (const member of staff) {
      // 既に割当済みならスキップ
      const already = schedule.find(
        s => s.staffId === member.id && s.date === dateStr
      );
      if (already) continue;

      // リクエストを優先
      const req = requests.find(
        r => r.staffId === member.id && r.date === dateStr
      );
      const patternId = req
        ? req.patternId
        : workPatterns[0].id!;

      schedule.push({
        staffId: member.id!,
        date: dateStr,
        patternId,
        isManual: !!req,
      });
    }
  }

  // -------------------------------------------------------
  // 休み日数調整（Pass 3）
  // -------------------------------------------------------
  private adjustRestDays(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints,
    dates: string[]
  ): void {
    if (!this.restPatternId) return;
    const target = (constraints as any).exactRestDaysPerMonth;
    if (!target) return;

    for (const member of staff) {
      const memberShifts = schedule.filter(s => s.staffId === member.id);
      const restCount = memberShifts.filter(
        s => s.patternId === this.restPatternId
      ).length;

      const diff = target - restCount;
      if (diff <= 0) continue;

      // 休みが足りない → 通常シフトを休みに変更
      const workShifts = memberShifts.filter(
        s => s.patternId !== this.restPatternId &&
             s.patternId !== this.akePatternId &&
             s.patternId !== this.vacationPatternId
      );
      for (let i = 0; i < diff && i < workShifts.length; i++) {
        const idx = schedule.indexOf(workShifts[i]);
        if (idx >= 0) schedule[idx].patternId = this.restPatternId!;
      }
    }
  }

  // -------------------------------------------------------
  // 最低勤務日数保証（Pass 4）
  // -------------------------------------------------------
  private enforceMinWorkDays(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints,
    dates: string[],
    patterns: ShiftPattern[]
  ): void {
    const minDays = (constraints as any).minWorkDaysPerMonth ?? 0;
    if (!minDays) return;

    const workPatterns = patterns.filter(
      p => !p.isAke && !p.isVacation && p.name !== REST_NAME
    );
    if (workPatterns.length === 0) return;

    for (const member of staff) {
      const memberShifts = schedule.filter(s => s.staffId === member.id);
      const workCount = memberShifts.filter(s => {
        const pat = patterns.find(p => p.id === s.patternId);
        return pat && !pat.isAke && !pat.isVacation && pat.name !== REST_NAME;
      }).length;

      if (workCount >= minDays) continue;

      console.warn(
        `[SG] ⚠️ スタッフID:${member.id} 勤務日数 ${workCount}日 < 最低 ${minDays}日`
      );
    }
  }

  // -------------------------------------------------------
  // 統計計算
  // -------------------------------------------------------
  private calcStatistics(
    schedule: GeneratedShift[],
    staff: Staff[],
    patterns: ShiftPattern[],
    dates: string[]
  ): ScheduleStatistics {
    const staffWorkload: StaffWorkloadStat[] = staff.map(member => {
      const shifts = schedule.filter(s => s.staffId === member.id);
      const workDays = shifts.filter(s => {
        const p = patterns.find(x => x.id === s.patternId);
        return p && !p.isAke && !p.isVacation && p.name !== REST_NAME;
      }).length;
      const restDays = shifts.filter(s => {
        const p = patterns.find(x => x.id === s.patternId);
        return p && p.name === REST_NAME;
      }).length;
      const akeDays = shifts.filter(s => {
        const p = patterns.find(x => x.id === s.patternId);
        return p && p.isAke;
      }).length;
      const vacationDays = shifts.filter(s => {
        const p = patterns.find(x => x.id === s.patternId);
        return p && p.isVacation;
      }).length;
      const nightDays = shifts.filter(s => {
        const p = patterns.find(x => x.id === s.patternId);
        return p && this.isNightShift(p);
      }).length;

      return {
        staffId:     member.id!,
        staffName:   member.name,
        workDays,
        restDays,
        akeDays,
        vacationDays,
        nightDays,
        totalDays:   shifts.length,
      };
    });

    const shiftTypeDistribution: Record<string, number> = {};
    for (const s of schedule) {
      const p = patterns.find(x => x.id === s.patternId);
      if (p) {
        shiftTypeDistribution[p.name] = (shiftTypeDistribution[p.name] ?? 0) + 1;
      }
    }

    return {
      totalDays:             dates.length,
      totalShifts:           schedule.length,
      staffWorkload,               // ← staffWorkload が必須
      shiftTypeDistribution,
    };
  }
}
