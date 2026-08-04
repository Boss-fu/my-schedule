/**
 * Verifies the money/status logic actually behaves, by extracting the helper
 * functions from teacher.html and running them against fixtures.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'teacher.html');
const html = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`); }
}

// ---- extract helpers from the source so we test the shipped code, not a copy ----
function grab(re, label) {
  const m = html.match(re);
  if (!m) throw new Error('could not extract ' + label);
  return m[0];
}
const statusLabel = grab(/const STATUS_LABEL=\{[^}]*\};/, 'STATUS_LABEL');
const billable = grab(/const billable=list=>[^;]*;/, 'billable');
const sumFee = grab(/const sumFee=list=>[^;]*;/, 'sumFee');
const sumHours = grab(/const sumHours=list=>[^;]*;/, 'sumHours');
const localDate = grab(/function localDate\(d\)\{return `[^`]*`\}/, 'localDate');
const localMonth = grab(/function localMonth\(d\)\{return `[^`]*`\}/, 'localMonth');
const minutesOf = grab(/function minutesOf\(t\)\{[^\n]*/, 'minutesOf');
const rangeHours = grab(/function rangeHours\(start,end\)\{[^\n]*/, 'rangeHours');

const ctx = new Function(`
  ${statusLabel}${billable}${sumFee}${sumHours}
  ${localDate}
  ${localMonth}
  ${minutesOf}
  ${rangeHours}
  return {STATUS_LABEL,billable,sumFee,sumHours,localDate,localMonth,rangeHours};
`)();

console.log('\n=== 出席狀態與收費 ===');
const lessons = [
  { id: 'a', hours: 2, rate: 1000, status: 'attended' },
  { id: 'b', hours: 2, rate: 1000, status: 'leave'    },
  { id: 'c', hours: 1.5, rate: 800, status: 'absent'  },
  { id: 'd', hours: 3, rate: 1200, status: 'attended' },
];
check('billable 只留實到', ctx.billable(lessons).map(l => l.id), ['a', 'd']);
check('sumFee 只計實到 (2*1000 + 3*1200)', ctx.sumFee(lessons), 5600);
check('sumHours 只計實到 (2 + 3)', ctx.sumHours(lessons), 5);
check('空陣列不炸', ctx.sumFee([]), 0);
check('全部請假 → 0 元', ctx.sumFee([lessons[1]]), 0);
check('狀態標籤', [ctx.STATUS_LABEL.attended, ctx.STATUS_LABEL.leave, ctx.STATUS_LABEL.absent], ['實到', '請假', '缺席']);

console.log('\n=== 時區：台灣凌晨不可偏移 ===');
// 台灣 UTC+8：本地 8/4 早上 07:00 → UTC 仍是 8/3 23:00
const earlyMorning = new Date(2026, 7, 4, 7, 0, 0); // local Aug 4 07:00
check('localDate 取本地日期', ctx.localDate(earlyMorning), '2026-08-04');
check('localMonth 取本地月份', ctx.localMonth(earlyMorning), '2026-08');
// 對照組：舊寫法在 UTC+8 會退成前一天
const utcSlice = new Date(Date.UTC(2026, 7, 3, 23, 0, 0)).toISOString().slice(0, 10);
check('（對照）舊的 toISOString 確實會偏移', utcSlice, '2026-08-03');

// 月初邊界
check('月初 00:30 仍是當月', ctx.localMonth(new Date(2026, 7, 1, 0, 30)), '2026-08');
check('月底 23:30 仍是當月', ctx.localMonth(new Date(2026, 7, 31, 23, 30)), '2026-08');
check('跨年 1/1 凌晨', ctx.localDate(new Date(2027, 0, 1, 2, 0)), '2027-01-01');

console.log('\n=== 時數由起訖時間推導（時數直接決定學費） ===');
check('19:00–21:00 = 2 小時', ctx.rangeHours('19:00', '21:00'), 2);
check('18:30–20:30 = 2 小時', ctx.rangeHours('18:30', '20:30'), 2);
check('19:00–20:30 = 1.5 小時', ctx.rangeHours('19:00', '20:30'), 1.5);
check('19:00–19:45 = 0.75 小時', ctx.rangeHours('19:00', '19:45'), 0.75);
check('09:00–12:00 = 3 小時', ctx.rangeHours('09:00', '12:00'), 3);
check('結束早於開始 → null', ctx.rangeHours('21:00', '19:00'), null);
check('起訖相同 → null', ctx.rangeHours('19:00', '19:00'), null);
check('空值 → null', ctx.rangeHours('', '21:00'), null);
check('兩者皆未填 → null', ctx.rangeHours(undefined, undefined), null);
check('含秒數仍可解析', ctx.rangeHours('19:00:00', '21:00:00'), 2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
