import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Download, FileText, FileSpreadsheet, Printer,
  CheckCircle, AlertCircle, Loader2,
} from 'lucide-react';
import { db } from '../db';

// ========================================
// データ取得ヘルパー
// ========================================
async function fetchExportData(year: number, month: number) {
  const mm = String(month).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;
  const endDate   = `${year}-${mm}-31`;

  const [allStaff, allPatterns, monthShifts] = await Promise.all([
    db.staff.toArray(),
    db.shiftPatterns.toArray(),
    db.shifts.where('date').between(startDate, endDate, true, true).toArray(),
  ]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    return `${year}-${mm}-${d}`;
  });

  const patternByName = new Map(allPatterns.map(p => [p.name, p]));

  // staff × date マトリクス
  const shiftMatrix = new Map<string, Map<string, string>>(
    allStaff.map(s => [s.id, new Map()])
  );
  monthShifts.forEach(shift => {
    shiftMatrix.get(shift.staffId)?.set(shift.date, shift.shiftType);
  });

  return { allStaff, allPatterns, monthShifts, days, patternByName, shiftMatrix };
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// ========================================
// メインコンポーネント
// ========================================
export function ExportPanel() {
  const today = new Date();
  const [year,      setYear]      = useState(today.getFullYear());
  const [month,     setMonth]     = useState(today.getMonth() + 1);
  const [exporting, setExporting] = useState<'csv' | 'excel' | 'pdf' | null>(null);
  const [message,   setMessage]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const years  = Array.from({ length: 3 }, (_, i) => today.getFullYear() - 1 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // ── CSV エクスポート ──
  const exportCSV = useCallback(async () => {
    try {
      setExporting('csv');
      const { allStaff, days, shiftMatrix } = await fetchExportData(year, month);

      if (allStaff.length === 0) { showMsg('error', 'スタッフが登録されていません。'); return; }

      const dayNums = days.map(d => parseInt(d.split('-')[2]));
      const header  = ['スタッフ名', '役職', ...dayNums.map(n => `${n}日`)];
      const rows    = allStaff.map(s => {
        const m = shiftMatrix.get(s.id) ?? new Map();
        return [s.name, s.position, ...days.map(d => m.get(d) ?? '')];
      });

      const csv = [header, ...rows]
        .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `勤務表_${year}年${String(month).padStart(2, '0')}月.csv`;
      a.click();
      URL.revokeObjectURL(url);

      showMsg('success', 'CSVファイルをダウンロードしました ✅');
    } catch (e) {
      console.error('CSV エクスポートエラー:', e);
      showMsg('error', 'CSV エクスポートに失敗しました。');
    } finally {
      setExporting(null);
    }
  }, [year, month]);

  // ── Excel エクスポート ──
  const exportExcel = useCallback(async () => {
    try {
      setExporting('excel');
      const { allStaff, days, patternByName, shiftMatrix } = await fetchExportData(year, month);

      if (allStaff.length === 0) { showMsg('error', 'スタッフが登録されていません。'); return; }

      const dayNums = days.map(d => parseInt(d.split('-')[2]));

      // ヘッダー行（曜日付き）
      const headerRow = [
        'スタッフ名', '役職',
        ...dayNums.map(d => {
          const wd = new Date(year, month - 1, d).getDay();
          return `${d}(${WEEKDAYS[wd]})`;
        }),
      ];

      // データ行（略称表示）
      const dataRows = allStaff.map(s => {
        const m = shiftMatrix.get(s.id) ?? new Map();
        return [
          s.name, s.position,
          ...days.map(d => {
            const st = m.get(d) ?? '';
            return patternByName.get(st)?.shortName ?? st;
          }),
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

      // 列幅設定
      ws['!cols'] = [
        { wch: 14 }, { wch: 9 },
        ...dayNums.map(() => ({ wch: 5 })),
      ];

      // 行高さ設定
      ws['!rows'] = [{ hpx: 28 }, ...dataRows.map(() => ({ hpx: 22 }))];

      const wb = XLSX.utils.book_new();
      const sheetName = `${year}年${String(month).padStart(2, '0')}月`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `勤務表_${year}年${String(month).padStart(2, '0')}月.xlsx`);

      showMsg('success', 'Excelファイルをダウンロードしました ✅');
    } catch (e) {
      console.error('Excel エクスポートエラー:', e);
      showMsg('error', 'Excel エクスポートに失敗しました。');
    } finally {
      setExporting(null);
    }
  }, [year, month]);

  // ── PDF エクスポート（印刷ダイアログ）──
  const exportPDF = useCallback(async () => {
    try {
      setExporting('pdf');
      const { allStaff, days, patternByName, shiftMatrix } = await fetchExportData(year, month);

      if (allStaff.length === 0) { showMsg('error', 'スタッフが登録されていません。'); return; }

      const dayNums = days.map(d => parseInt(d.split('-')[2]));

      const theadCells = dayNums.map(d => {
        const wd   = new Date(year, month - 1, d).getDay();
        const color = wd === 0 ? '#dc2626' : wd === 6 ? '#2563eb' : '#374151';
        return `<th style="width:24px;text-align:center;color:${color};font-size:9px;padding:2px 1px;">
          ${d}<br/><span style="font-size:8px">${WEEKDAYS[wd]}</span>
        </th>`;
      }).join('');

      const tbodyRows = allStaff.map(s => {
        const m = shiftMatrix.get(s.id) ?? new Map();
        const cells = days.map(d => {
          const st      = m.get(d) ?? '';
          const pattern = patternByName.get(st);
          const short   = pattern?.shortName ?? (st ? st.substring(0, 1) : '');
          const color   = pattern?.color ?? '';
          return `<td style="text-align:center;font-size:9px;padding:1px;background:${color ? color + '22' : 'transparent'};color:${color || '#111'};font-weight:600">${short}</td>`;
        }).join('');
        return `<tr>
          <td style="padding:2px 5px;white-space:nowrap;font-size:10px">${s.name}</td>
          <td style="padding:2px 4px;font-size:9px;color:#666">${s.position}</td>
          ${cells}
        </tr>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>勤務表 ${year}年${String(month).padStart(2, '0')}月</title>
  <style>
    @page { size: A3 landscape; margin: 10mm; }
    @media print { body { margin: 0; } .no-print { display: none; } }
    body  { font-family: 'Hiragino Sans', 'Yu Gothic UI', 'Meiryo', sans-serif; font-size: 10px; }
    h2    { text-align: center; font-size: 14px; margin: 0 0 8px; }
    p.sub { text-align: center; font-size: 9px; color: #888; margin: 0 0 6px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { border: 1px solid #ccc; }
    th    { background: #f3f4f6; padding: 3px 2px; font-size: 9px; }
    .no-print { text-align: center; margin: 12px 0; }
    button { padding: 8px 20px; background: #4f46e5; color: #fff; border: none;
             border-radius: 6px; cursor: pointer; font-size: 13px; }
  </style>
</head>
<body>
  <h2>勤務表　${year}年${String(month).padStart(2, '0')}月</h2>
  <p class="sub">出力日時: ${new Date().toLocaleString('ja-JP')}</p>
  <div class="no-print">
    <button onclick="window.print()">🖨️ 印刷 / PDF保存</button>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:90px;text-align:left;padding:3px 6px">スタッフ名</th>
        <th style="width:65px;text-align:left;padding:3px 4px">役職</th>
        ${theadCells}
      </tr>
    </thead>
    <tbody>${tbodyRows}</tbody>
  </table>
</body>
</html>`;

      const win = window.open('', '_blank', 'width=1200,height=800');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        // ページ読み込み後に印刷ダイアログを自動起動
        win.onload = () => {
          setTimeout(() => win.print(), 300);
        };
        showMsg('success', '印刷プレビューを開きました（PDF保存も可能です）✅');
      } else {
        showMsg('error', 'ポップアップがブロックされました。ブラウザの設定で許可してください。');
      }
    } catch (e) {
      console.error('PDF エクスポートエラー:', e);
      showMsg('error', 'PDF エクスポートに失敗しました。');
    } finally {
      setExporting(null);
    }
  }, [year, month]);

  // ========== レンダリング ==========
  return (
    <div className="space-y-6">

      {/* ── ヘッダー ── */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
          <Download className="w-6 h-6 text-indigo-600" />
          エクスポート（Phase 5）
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          対象月を選択してエクスポート形式ボタンをクリックしてください。
        </p>

        {/* 年月選択 */}
        <div className="flex flex-wrap gap-4 mb-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">年</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm">
              {years.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">月</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm">
              {months.map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
          </div>
        </div>

        {/* メッセージ */}
        {message && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm mt-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {message.text}
          </div>
        )}
      </div>

      {/* ── エクスポートボタン ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* CSV */}
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <FileText className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">CSV 形式</h3>
              <p className="text-xs text-gray-500">Excel・スプレッドシートで開けます</p>
            </div>
          </div>
          <ul className="text-xs text-gray-600 space-y-1 mb-4 flex-1">
            <li>✅ スタッフ名 × 日付マトリクス</li>
            <li>✅ BOM付きUTF-8（日本語対応）</li>
            <li>✅ シフト種別名（フル）を出力</li>
          </ul>
          <button
            onClick={exportCSV}
            disabled={exporting !== null}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {exporting === 'csv'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</>
              : <><Download className="w-4 h-4" /> CSV ダウンロード</>}
          </button>
        </div>

        {/* Excel */}
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <FileSpreadsheet className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Excel 形式 (.xlsx)</h3>
              <p className="text-xs text-gray-500">Microsoft Excel で開けます</p>
            </div>
          </div>
          <ul className="text-xs text-gray-600 space-y-1 mb-4 flex-1">
            <li>✅ スタッフ名 × 日付マトリクス</li>
            <li>✅ 曜日表示付きヘッダー</li>
            <li>✅ シフト略称で出力（見やすい）</li>
            <li>✅ 列幅・行高さ自動調整</li>
          </ul>
          <button
            onClick={exportExcel}
            disabled={exporting !== null}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {exporting === 'excel'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</>
              : <><Download className="w-4 h-4" /> Excel ダウンロード</>}
          </button>
        </div>

        {/* PDF */}
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-red-100 rounded-xl">
              <Printer className="w-7 h-7 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">PDF 印刷/保存</h3>
              <p className="text-xs text-gray-500">A3横向きで印刷・PDF保存できます</p>
            </div>
          </div>
          <ul className="text-xs text-gray-600 space-y-1 mb-4 flex-1">
            <li>✅ 日本語フォント完全対応</li>
            <li>✅ シフト色付きカラー表示</li>
            <li>✅ A3横向き推奨レイアウト</li>
            <li>✅ ブラウザの「PDFとして保存」でPDF化</li>
          </ul>
          <button
            onClick={exportPDF}
            disabled={exporting !== null}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {exporting === 'pdf'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> 準備中...</>
              : <><Printer className="w-4 h-4" /> 印刷プレビューを開く</>}
          </button>
        </div>
      </div>

      {/* ── 使用ガイド ── */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-800 mb-3">📌 PDF保存手順（ブラウザ標準機能）</h4>
        <ol className="text-sm text-indigo-700 space-y-1 list-decimal list-inside">
          <li>「印刷プレビューを開く」をクリック → 新しいウィンドウが開きます</li>
          <li>印刷ダイアログが自動で起動します（起動しない場合は「🖨️ 印刷/PDF保存」ボタンをクリック）</li>
          <li>プリンタの選択で「<strong>PDFとして保存</strong>」または「<strong>Microsoft Print to PDF</strong>」を選択</li>
          <li>用紙サイズ「<strong>A3</strong>」・向き「<strong>横</strong>」を確認して保存</li>
        </ol>
      </div>

    </div>
  );
}
