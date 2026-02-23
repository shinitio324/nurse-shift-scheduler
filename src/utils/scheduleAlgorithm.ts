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

/**
 * スケジュール生成エンジン
 */
export class ScheduleGenerator {
  private staff: Staff[];
  private patterns: ShiftPattern[];
  private constraints: ScheduleConstraints[];
  private requests: ShiftRequest[];
  private params: ScheduleGenerationParams;
  
  private schedules: GeneratedSchedule[] = [];
  private violations: ConstraintViolation[] = [];

  constructor(
    staff: Staff[],
    patterns: ShiftPattern[],
    constraints: ScheduleConstraints[],
    requests: ShiftRequest[],
    params: ScheduleGenerationParams
  ) {
    this.staff = staff;
    this.patterns = patterns.filter(p => p.isActive);
    this.constraints = constraints
      .filter(c => c.isActive && params.constraintIds.includes(c.id))
      .sort((a, b) => b.priority - a.priority);
    this.requests = requests;
    this.params = params;
  }

  /**
   * スケジュールを生成
   */
  public generate(): ScheduleGenerationResult {
    console.log('🚀 スケジュール生成を開始します...');
    console.log('📅 対象:', `${this.params.targetYear}年${this.params.targetMonth}月`);
    console.log('👥 スタッフ:', this.staff.length, '名');
    console.log('📋 勤務パターン:', this.patterns.length, '種類');
    console.log('⚖️ 制約条件:', this.constraints.length, '種類');
    console.log('📝 シフト希望:', this.requests.length, '件');

    this.schedules = [];
    this.violations = [];

    const daysInMonth = this.getDaysInMonth(
      this.params.targetYear,
      this.params.targetMonth
    );

    // 日付ごとにスケジュールを生成
    for (let day = 1; day <= daysInMonth; day++) {
      const date = this.formatDate(this.params.targetYear, this.params.targetMonth, day);
      console.log(`📆 ${date} のスケジュールを生成中...`);
      this.generateDaySchedule(date);
    }

    console.log('✅ スケジュール生成が完了しました！');
    console.log('📊 生成されたシフト:', this.schedules.length, '件');
    console.log('⚠️ 制約違反:', this.violations.length, '件');

    const statistics = this.calculateStatistics();

    return {
      schedules: this.schedules,
      statistics,
      violations: this.violations,
      generatedAt: new Date(),
    };
  }

  /**
   * 1日分のスケジュールを生成
   */
  private generateDaySchedule(date: string): void {
    // その日のシフト希望を取得
    const dayRequests = this.requests.filter(r => r.date === date);

    // 各勤務パターンに対して割り当て
    for (const pattern of this.patterns) {
      if (pattern.name === '休み') continue;

      const requiredStaff = pattern.requiredStaff;
      const assignedStaff: string[] = [];

      // 1. シフト希望を優先
      if (this.params.prioritizeRequests) {
        const requestedStaff = dayRequests
          .filter(r => r.shiftType === pattern.name)
          .map(r => r.staffId);

        for (const staffId of requestedStaff) {
          if (assignedStaff.length >= requiredStaff) break;
          if (this.canAssignStaff(staffId, date, pattern)) {
            assignedStaff.push(staffId);
          }
        }
      }

      // 2. 不足分を自動割り当て
      const remainingStaff = this.staff
        .map(s => s.id)
        .filter(id => !assignedStaff.includes(id));

      // ヒューリスティック: 勤務が少ないスタッフを優先
      const sortedStaff = this.sortStaffByWorkload(remainingStaff, date);

      for (const staffId of sortedStaff) {
        if (assignedStaff.length >= requiredStaff) break;
        if (this.canAssignStaff(staffId, date, pattern)) {
          assignedStaff.push(staffId);
        }
      }

      // スケジュールに追加
      for (const staffId of assignedStaff) {
        const staff = this.staff.find(s => s.id === staffId);
        const isRequested = dayRequests.some(
          r => r.staffId === staffId && r.shiftType === pattern.name
        );

        this.schedules.push({
          id: crypto.randomUUID(),
          date,
          staffId,
          staffName: staff?.name || '不明',
          shiftType: pattern.name,
          isManuallyAdjusted: false,
          constraintViolations: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // 必要人数に満たない場合は警告
      if (assignedStaff.length < requiredStaff) {
        this.violations.push({
          date,
          staffId: '',
          staffName: '',
          constraintName: '必要人数',
          violationType: 'required_staff',
          severity: 'error',
          message: `${pattern.name}の必要人数${requiredStaff}名に対して${assignedStaff.length}名しか割り当てられませんでした`,
        });
      }
    }

    // 休みのスタッフを割り当て
    const workedStaff = this.schedules
      .filter(s => s.date === date)
      .map(s => s.staffId);

    for (const staff of this.staff) {
      if (!workedStaff.includes(staff.id)) {
        this.schedules.push({
          id: crypto.randomUUID(),
          date,
          staffId: staff.id,
          staffName: staff.name,
          shiftType: '休み',
          isManuallyAdjusted: false,
          constraintViolations: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  /**
   * スタッフにシフトを割り当て可能か判定
   */
  private canAssignStaff(staffId: string, date: string, pattern: ShiftPattern): boolean {
    // すでにその日に勤務が割り当てられているか
    const alreadyAssigned = this.schedules.some(
      s => s.staffId === staffId && s.date === date
    );
    if (alreadyAssigned) return false;

    // 制約条件をチェック
    for (const constraint of this.constraints) {
      if (!this.checkConstraint(staffId, date, pattern, constraint)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 制約条件をチェック
   */
  private checkConstraint(
    staffId: string,
    date: string,
    pattern: ShiftPattern,
    constraint: ScheduleConstraints
  ): boolean {
    const staffSchedules = this.schedules.filter(s => s.staffId === staffId);

    // 1. 連続勤務日数チェック
    const consecutiveWork = this.getConsecutiveWorkDays(staffId, date);
    if (consecutiveWork >= constraint.maxConsecutiveWorkDays) {
      return false;
    }

    // 2. 連続夜勤チェック
    if (this.isNightShift(pattern.name)) {
      const consecutiveNight = this.getConsecutiveNightShifts(staffId, date);
      if (consecutiveNight >= constraint.maxConsecutiveNightShifts) {
        return false;
      }
    }

    // 3. 月間夜勤回数チェック
    if (this.isNightShift(pattern.name)) {
      const monthNightShifts = staffSchedules.filter(s =>
        this.isNightShift(s.shiftType)
      ).length;
      if (monthNightShifts >= constraint.maxNightShiftsPerMonth) {
        return false;
      }
    }

    return true;
  }

  /**
   * 連続勤務日数を取得
   */
  private getConsecutiveWorkDays(staffId: string, currentDate: string): number {
    let count = 0;
    let date = new Date(currentDate);
    date.setDate(date.getDate() - 1);

    while (true) {
      const dateStr = date.toISOString().split('T')[0];
      const schedule = this.schedules.find(
        s => s.staffId === staffId && s.date === dateStr
      );

      if (!schedule || schedule.shiftType === '休み') break;
      count++;
      date.setDate(date.getDate() - 1);
    }

    return count;
  }

  /**
   * 連続夜勤回数を取得
   */
  private getConsecutiveNightShifts(staffId: string, currentDate: string): number {
    let count = 0;
    let date = new Date(currentDate);
    date.setDate(date.getDate() - 1);

    while (true) {
      const dateStr = date.toISOString().split('T')[0];
      const schedule = this.schedules.find(
        s => s.staffId === staffId && s.date === dateStr
      );

      if (!schedule || !this.isNightShift(schedule.shiftType)) break;
      count++;
      date.setDate(date.getDate() - 1);
    }

    return count;
  }

  /**
   * 夜勤かどうかを判定
   */
  private isNightShift(shiftType: string): boolean {
    return shiftType.includes('夜勤') || shiftType.includes('夜');
  }

  /**
   * スタッフを勤務量でソート（少ない順）
   */
  private sortStaffByWorkload(staffIds: string[], currentDate: string): string[] {
    return staffIds.sort((a, b) => {
      const aWorkload = this.schedules.filter(
        s => s.staffId === a && s.shiftType !== '休み'
      ).length;
      const bWorkload = this.schedules.filter(
        s => s.staffId === b && s.shiftType !== '休み'
      ).length;
      return aWorkload - bWorkload;
    });
  }

  /**
   * 統計情報を計算
   */
  private calculateStatistics(): ScheduleStatistics {
    const daysInMonth = this.getDaysInMonth(
      this.params.targetYear,
      this.params.targetMonth
    );

    const staffWorkload = this.staff.map(staff => {
      const staffSchedules = this.schedules.filter(s => s.staffId === staff.id);
      const workShifts = staffSchedules.filter(s => s.shiftType !== '休み');
      const nightShifts = workShifts.filter(s => this.isNightShift(s.shiftType));
      const restDays = staffSchedules.filter(s => s.shiftType === '休み');

      return {
        staffId: staff.id,
        staffName: staff.name,
        totalShifts: workShifts.length,
        nightShifts: nightShifts.length,
        restDays: restDays.length,
        consecutiveWorkDays: this.getMaxConsecutiveWorkDays(staff.id),
        totalWorkHours: this.calculateTotalWorkHours(staff.id),
      };
    });

    const shiftTypeDistribution = this.patterns.map(pattern => {
      const count = this.schedules.filter(s => s.shiftType === pattern.name).length;
      const daysCount = pattern.name === '休み' ? daysInMonth : daysInMonth;
      const requiredTotal = pattern.name === '休み' ? 0 : pattern.requiredStaff * daysInMonth;
      const actualStaff = pattern.name === '休み' ? 0 : count / daysCount;

      return {
        shiftType: pattern.name,
        count,
        requiredStaff: pattern.requiredStaff,
        actualStaff: Math.round(actualStaff * 10) / 10,
      };
    });

    return {
      totalDays: daysInMonth,
      totalShifts: this.schedules.filter(s => s.shiftType !== '休み').length,
      staffWorkload,
      shiftTypeDistribution,
    };
  }

  /**
   * 最大連続勤務日数を取得
   */
  private getMaxConsecutiveWorkDays(staffId: string): number {
    const staffSchedules = this.schedules
      .filter(s => s.staffId === staffId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (const schedule of staffSchedules) {
      if (schedule.shiftType !== '休み') {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    return maxConsecutive;
  }

  /**
   * 総勤務時間を計算
   */
  private calculateTotalWorkHours(staffId: string): number {
    const staffSchedules = this.schedules.filter(
      s => s.staffId === staffId && s.shiftType !== '休み'
    );

    let totalHours = 0;
    for (const schedule of staffSchedules) {
      const pattern = this.patterns.find(p => p.name === schedule.shiftType);
      if (pattern && pattern.startTime && pattern.endTime) {
        const hours = this.calculateShiftHours(pattern.startTime, pattern.endTime);
        totalHours += hours;
      }
    }

    return Math.round(totalHours * 10) / 10;
  }

  /**
   * シフトの勤務時間を計算
   */
  private calculateShiftHours(startTime: string, endTime: string): number {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    let hours = endHour - startHour;
    let minutes = endMinute - startMinute;

    if (hours < 0) hours += 24; // 日をまたぐ場合
    if (minutes < 0) {
      hours -= 1;
      minutes += 60;
    }

    return hours + minutes / 60;
  }

  /**
   * 月の日数を取得
   */
  private getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  /**
   * 日付をフォーマット
   */
  private formatDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}
