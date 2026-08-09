/* ============================================================
   数据层 · 全本地存储（无服务器，隐私不出设备）
   后续可平滑替换为 IndexedDB / Capacitor Preferences
   ============================================================ */
import { dayKey, weekKey, monthKey } from './utils/time.js';

const K_REC = 'pm.records.v1';
const K_SET = 'pm.settings.v1';

const DEFAULT_SETTINGS = {
  nickname: '',          // 空 = 显示中性占位「朋友」
  energyLimit: 10,       // 每日精力上限（设置页可调）
  weekStart: 1,          // 1 = 周一起算
  aiEnabled: true,       // 云端 AI 解析开关
  aiEstimateEnergy: true,// AI 自动预估精力值
  pushEnabled: true,     // 超上限系统推送
  apiKey: '',            // DeepSeek API Key（仅存本地）
  apiModel: 'deepseek-v4-flash',  // 现役主力模型，1M 上下文，¥1/百万输入
  fontSize: 'm',         // 字体档：s / m / l
  bgTheme: 'pink',       // 背景主题：pink / mint / butter / lav
  lang: 'zh-CN',         // 语言：当前仅简体中文生效
};

/* —— 外观主题：字体档 —— */
export const FONT_TIERS = {
  s: { '--fs-xs':'10px','--fs-sm':'11px','--fs-base':'13px','--fs-md':'14px','--fs-lg':'16px','--fs-xl':'19px','--fs-2xl':'22px','--fs-3xl':'27px' },
  m: { '--fs-xs':'11px','--fs-sm':'12px','--fs-base':'14px','--fs-md':'15px','--fs-lg':'17px','--fs-xl':'20px','--fs-2xl':'24px','--fs-3xl':'30px' },
  l: { '--fs-xs':'12px','--fs-sm':'13px','--fs-base':'15px','--fs-md':'16px','--fs-lg':'19px','--fs-xl':'23px','--fs-2xl':'28px','--fs-3xl':'35px' },
};

/* —— 外观主题：背景渐变 —— */
export const BG_THEMES = [
  { id:'pink',   label:'蜜桃',   css:'linear-gradient(170deg,#FFF4F7 0%,#FFFAFB 32%,#F7F4FD 100%)' },
  { id:'mint',   label:'薄荷',   css:'linear-gradient(170deg,#F1FCF8 0%,#FFFAFB 32%,#E4F1FB 100%)' },
  { id:'butter', label:'奶黄',   css:'linear-gradient(170deg,#FFF6DC 0%,#FFFAFB 32%,#FFEDE3 100%)' },
  { id:'lav',    label:'薰衣草', css:'linear-gradient(170deg,#F7F4FD 0%,#FFFAFB 32%,#ECE5FA 100%)' },
];

/** 把当前设置应用到 #app（字体档 + 背景），供设置页实时预览与启动时调用 */
export function applyAppTheme() {
  const s = getSettings();
  const app = document.getElementById('app');
  if (!app) return;
  const ft = FONT_TIERS[s.fontSize] || FONT_TIERS.m;
  for (const [k, v] of Object.entries(ft)) app.style.setProperty(k, v);
  const bg = (BG_THEMES.find(b => b.id === s.bgTheme) || BG_THEMES[0]).css;
  app.style.background = bg;
}

function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { console.warn('存储失败', e); return false; }
}

/* —— 设置 —— */
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read(K_SET, {}) });
export function setSetting(patch) {
  const next = { ...getSettings(), ...patch };
  write(K_SET, next);
  return next;
}

/* —— 记录 —— */
export const allRecords = () => read(K_REC, []);

export function saveRecord(rec) {
  const list = allRecords();
  if (!rec.id) {
    rec.id = 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    rec.createdAt = rec.createdAt || new Date().toISOString();
    list.unshift(rec);
  } else {
    const i = list.findIndex(r => r.id === rec.id);
    if (i >= 0) list[i] = rec; else list.unshift(rec);
  }
  rec.updatedAt = new Date().toISOString();
  write(K_REC, list);
  return rec;
}

export function deleteRecord(id) {
  write(K_REC, allRecords().filter(r => r.id !== id));
}

export const byType = (type) => allRecords().filter(r => r.type === type);

/* —— 归档索引：日 / 周 / 月 / 年 —— */
export function bucketOf(rec) {
  const d = new Date(rec.occurredAt || rec.createdAt);
  return { day: dayKey(d), week: weekKey(d), month: monthKey(d), year: String(d.getFullYear()) };
}

/* —— 首页今日概览需要的数据 —— */
export function todayDigest() {
  const today = dayKey();
  const recs = allRecords();

  const todos = recs
    .filter(r => r.type === 'todo')
    .filter(r => dayKey(new Date(r.occurredAt || r.createdAt)) === today)
    .slice(0, 4);

  const ledgers = recs
    .filter(r => r.type === 'ledger')
    .filter(r => dayKey(new Date(r.occurredAt || r.createdAt)) === today);

  const expense = ledgers.filter(r => !r.isIncome).reduce((s, r) => s + (+r.amount || 0), 0);
  const income  = ledgers.filter(r =>  r.isIncome).reduce((s, r) => s + (+r.amount || 0), 0);
  const topExp  = ledgers.filter(r => !r.isIncome).sort((a, b) => (+b.amount) - (+a.amount))[0] || null;

  // 精力口径：今日全部待办（含已完成）= 当天的精力负荷，用于超上限提醒
  const energyUsed = todos
    .reduce((s, t) => s + ({ low: 1, mid: 2, high: 3 }[t.energy] || 0), 0);

  return { todos, expense, income, topExp, energyUsed };
}

/* —— 导出 / 导入备份 —— */
export function exportJSON() {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    records: allRecords(),
  }, null, 2);
}
