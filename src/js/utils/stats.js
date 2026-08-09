/* ============================================================
   记账统计聚合层
   周期规则：
   - 日 = 自然日；月 = 自然月；年 = 自然年（符合直觉，与银行账单一致）
   - 周 = 周一起算的 7 天；命名遵循「周一所在月份」归属规则
   - 月视图的周柱：每天只归入一根柱，总和 === 当月总额，绝不重复计
   ============================================================ */
import { mondayOf, weekMeta, weeksInMonth, friendlyDate } from './time.js';
import { allRecords } from '../store.js';

export const PERIODS = [
  { key: 'day',   label: '日' },
  { key: 'week',  label: '周' },
  { key: 'month', label: '月' },
  { key: 'year',  label: '年' },
];

/* —— 品类配色（马卡龙） —— */
const CAT_COLOR = {
  餐饮: '#FFB3C6', 交通: '#CCE5F7', 购物: '#DDD1F5', 居家: '#FFE09A',
  娱乐: '#A3E3CB', 医疗: '#FFDCC9', 学习: '#C4EFDF', 人情: '#FFD1DF',
  工资: '#5FC3A0', 收入: '#A3E3CB', 其他: '#E4DCE0',
};
export const catColor = (name) => CAT_COLOR[name] || '#E4DCE0';

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** 周期区间 [start, end) */
export function periodRange(period, anchor = new Date()) {
  const y = anchor.getFullYear(), m = anchor.getMonth();
  if (period === 'day')   { const s = startOfDay(anchor); return { start: s, end: addDays(s, 1) }; }
  if (period === 'week')  { const s = mondayOf(anchor);   return { start: s, end: addDays(s, 7) }; }
  if (period === 'month') return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
}

/** 前后平移一个周期 */
export function shiftAnchor(period, anchor, delta) {
  const y = anchor.getFullYear(), m = anchor.getMonth(), d = anchor.getDate();
  if (period === 'day')   return new Date(y, m, d + delta);
  if (period === 'week')  return new Date(y, m, d + delta * 7);
  if (period === 'month') return new Date(y, m + delta, 1);
  return new Date(y + delta, 0, 1);
}

/** 周期标题 */
export function periodLabel(period, anchor) {
  if (period === 'day') {
    const t = startOfDay(new Date()).getTime();
    const a = startOfDay(anchor).getTime();
    if (a === t) return '今天 · ' + friendlyDate(anchor);
    if (a === t - 86400000) return '昨天 · ' + friendlyDate(anchor);
    return friendlyDate(anchor);
  }
  if (period === 'week') {
    const w = weekMeta(anchor);
    return `${w.year}年${w.month}月 第${w.week}周`;
  }
  if (period === 'month') return `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`;
  return `${anchor.getFullYear()}年`;
}

/** 已是当前周期？（用于禁用「下一个」） */
export function isCurrentPeriod(period, anchor) {
  const { start, end } = periodRange(period, anchor);
  const now = Date.now();
  return now >= start.getTime() && now < end.getTime();
}

/** 该日在其所属月内归入第几根周柱（clamp 保证不漏不重） */
function weekBucketIndex(date, year, month, totalWeeks) {
  const w = weekMeta(date);
  if (w.year === year && w.month === month) return Math.min(w.week, totalWeeks);
  // 月初早于首个周一 → 并入第 1 周；月末周一已跨到下月 → 并入最后一周
  return date.getDate() < 15 ? 1 : totalWeeks;
}

/** 主聚合 */
export function ledgerStats(period, anchor = new Date()) {
  const { start, end } = periodRange(period, anchor);
  const s = start.getTime(), e = end.getTime();

  const inRange = allRecords()
    .filter(r => r.type === 'ledger')
    .map(r => ({ ...r, _t: new Date(r.occurredAt || r.createdAt).getTime() }))
    .filter(r => r._t >= s && r._t < e);

  const expense = inRange.filter(r => !r.isIncome).reduce((a, r) => a + (+r.amount || 0), 0);
  const income  = inRange.filter(r =>  r.isIncome).reduce((a, r) => a + (+r.amount || 0), 0);

  /* —— 趋势柱 —— */
  const trend = [];
  const bump = (idx, rec) => { if (trend[idx]) trend[idx].value += (+rec.amount || 0); };

  if (period === 'day') {
    // 近 7 日对比，末位为当前锚点日
    for (let i = 6; i >= 0; i--) {
      const d = addDays(start, -i);
      trend.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: 0, hi: i === 0, _d: d });
    }
    const wide = allRecords()
      .filter(r => r.type === 'ledger' && !r.isIncome)
      .map(r => ({ ...r, _t: new Date(r.occurredAt || r.createdAt).getTime() }));
    trend.forEach(b => {
      const bs = b._d.getTime(), be = addDays(b._d, 1).getTime();
      b.value = wide.filter(r => r._t >= bs && r._t < be).reduce((a, r) => a + (+r.amount || 0), 0);
      delete b._d;
    });
  } else if (period === 'week') {
    const names = ['一', '二', '三', '四', '五', '六', '日'];
    const todayKey = startOfDay(new Date()).getTime();
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      trend.push({ label: names[i], value: 0, hi: d.getTime() === todayKey });
    }
    inRange.filter(r => !r.isIncome).forEach(r => {
      const idx = Math.floor((startOfDay(new Date(r._t)) - start) / 86400000);
      bump(idx, r);
    });
  } else if (period === 'month') {
    const y = anchor.getFullYear(), mo = anchor.getMonth() + 1;
    const n = weeksInMonth(y, mo);
    const curW = weekMeta(new Date());
    for (let i = 1; i <= n; i++) {
      trend.push({ label: `第${i}周`, value: 0, hi: curW.year === y && curW.month === mo && curW.week === i });
    }
    inRange.filter(r => !r.isIncome).forEach(r => {
      bump(weekBucketIndex(new Date(r._t), y, mo, n) - 1, r);
    });
  } else {
    const curM = new Date();
    const sameYear = curM.getFullYear() === anchor.getFullYear();
    for (let i = 1; i <= 12; i++) {
      trend.push({ label: `${i}`, value: 0, hi: sameYear && curM.getMonth() + 1 === i });
    }
    inRange.filter(r => !r.isIncome).forEach(r => bump(new Date(r._t).getMonth(), r));
  }

  /* —— 品类占比（只统计支出） —— */
  const catMap = new Map();
  inRange.filter(r => !r.isIncome).forEach(r => {
    const k = r.category || '其他';
    catMap.set(k, (catMap.get(k) || 0) + (+r.amount || 0));
  });
  const categories = [...catMap.entries()]
    .map(([name, value]) => ({ name, value, pct: expense ? value / expense * 100 : 0, color: catColor(name) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  /* —— 最近记录 —— */
  const recent = inRange.sort((a, b) => b._t - a._t).slice(0, 8);

  return {
    expense, income, balance: income - expense,
    count: inRange.length,
    trend, categories, recent,
    trendMax: Math.max(1, ...trend.map(t => t.value)),
  };
}

/* ============================================================
   精力统计聚合层（模块 5 · 待办·精力）
   精力单位：低=1 / 中=2 / 高=3
   统计口径：周期内全部待办（含已完成），代表「精力负荷 / 习惯」
   日视图=近7日 · 周视图=每日 · 月视图=每周 · 年视图=每月
   ============================================================ */
export const ENERGY_MAP = { low: 1, mid: 2, high: 3 };
export const energyValue = (e) => ENERGY_MAP[e] || 0;

export function energyStats(period, anchor = new Date()) {
  const { start, end } = periodRange(period, anchor);
  const s = start.getTime(), e = end.getTime();

  const inRange = allRecords()
    .filter(r => r.type === 'todo')
    .map(r => ({ ...r, _t: new Date(r.occurredAt || r.createdAt).getTime() }))
    .filter(r => r._t >= s && r._t < e);

  const total = inRange.reduce((a, r) => a + energyValue(r.energy), 0);

  const levels = { high: 0, mid: 0, low: 0 };
  inRange.forEach(r => {
    const k = ['low', 'mid', 'high'].includes(r.energy) ? r.energy : 'low';
    levels[k]++;
  });

  const trend = [];
  const bump = (idx, val) => { if (trend[idx]) trend[idx].value += val; };

  if (period === 'day') {
    for (let i = 6; i >= 0; i--) {
      const d = addDays(start, -i);
      trend.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: 0, hi: i === 0, _d: d });
    }
    const wide = allRecords()
      .filter(r => r.type === 'todo')
      .map(r => ({ ...r, _t: new Date(r.occurredAt || r.createdAt).getTime() }));
    trend.forEach(b => {
      const bs = b._d.getTime(), be = addDays(b._d, 1).getTime();
      b.value = wide.filter(r => r._t >= bs && r._t < be).reduce((a, r) => a + energyValue(r.energy), 0);
      delete b._d;
    });
  } else if (period === 'week') {
    const names = ['一', '二', '三', '四', '五', '六', '日'];
    const todayKey = startOfDay(new Date()).getTime();
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      trend.push({ label: names[i], value: 0, hi: d.getTime() === todayKey });
    }
    inRange.forEach(r => {
      const idx = Math.floor((startOfDay(new Date(r._t)) - start) / 86400000);
      bump(idx, energyValue(r.energy));
    });
  } else if (period === 'month') {
    const y = anchor.getFullYear(), mo = anchor.getMonth() + 1;
    const n = weeksInMonth(y, mo);
    const curW = weekMeta(new Date());
    for (let i = 1; i <= n; i++) {
      trend.push({ label: `第${i}周`, value: 0, hi: curW.year === y && curW.month === mo && curW.week === i });
    }
    inRange.forEach(r => bump(weekBucketIndex(new Date(r._t), y, mo, n) - 1, energyValue(r.energy)));
  } else {
    const curM = new Date();
    const sameYear = curM.getFullYear() === anchor.getFullYear();
    for (let i = 1; i <= 12; i++) {
      trend.push({ label: `${i}`, value: 0, hi: sameYear && curM.getMonth() + 1 === i });
    }
    inRange.forEach(r => bump(new Date(r._t).getMonth(), energyValue(r.energy)));
  }

  return {
    total, count: inRange.length, levels,
    trend, trendMax: Math.max(1, ...trend.map(t => t.value)),
  };
}
