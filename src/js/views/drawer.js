/* ============================================================
   模块 6 · 汉堡抽屉（导航中枢）
   首页永远只有输入框，一切浏览类功能收进这里
   ============================================================ */
import { h, esc, toast } from '../utils/dom.js';
import { getSettings, exportJSON, allRecords, todayDigest } from '../store.js';
import { ledgerStats } from '../utils/stats.js';
import { go } from '../router.js';

const money = (n) => '¥' + (Math.round(n * 100) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ICON = {
  ledger: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5z"/><path d="M8 8h7M8 12h7"/></svg>`,
  wish:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20z"/></svg>`,
  todo:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>`,
  note:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4"/><path d="M8 9h8M8 13h5"/></svg>`,
  time:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  ai:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.2"/></svg>`,
  export: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M4 19h16"/></svg>`,
};

export function openDrawer() {
  const s = getSettings();
  const nick = s.nickname || '朋友';
  const mo = ledgerStats('month', new Date());

  const recs = allRecords();
  const wishCount = recs.filter(r => r.type === 'wish').length;
  const wishCost = recs.filter(r => r.type === 'wish').reduce((a, r) => a + (+r.estCost || 0), 0);
  const noteCount = recs.filter(r => r.type === 'note').length;
  const energyUsed = todayDigest().energyUsed;

  const host = document.getElementById('app');
  const mask = h(`
    <div class="drawer-mask">
      <div class="drawer">
        <div class="dw-head" data-act="settings">
          <div class="dw-avatar">${esc(nick.slice(0, 1))}</div>
          <div>
            <div class="dw-nick">嗨，${esc(nick)}<span class="edit-pen">✎</span></div>
            <div class="dw-sub">今天也在好好记录</div>
          </div>
        </div>

        <div class="dw-group">
          <button class="dw-item" data-go="ledger">
            <span class="dw-ico pink">${ICON.ledger}</span>
            <span class="dw-text"><b>记账看板</b><i>本月支出 ${money(mo.expense)} · ${mo.count} 笔</i></span>
            <span class="dw-arrow">›</span>
          </button>

          <button class="dw-item" data-go="wish">
            <span class="dw-ico lav">${ICON.wish}</span>
            <span class="dw-text"><b>愿望单</b><i>${wishCount ? `${wishCount} 个心愿 · 预估 ${money(wishCost)}` : '还没有心愿，说说想要什么'}</i></span>
            <span class="dw-arrow">›</span>
          </button>

          <button class="dw-item" data-go="todo">
            <span class="dw-ico mint">${ICON.todo}</span>
            <span class="dw-text"><b>待办 · 精力</b><i>今日精力 ${energyUsed} / ${s.energyLimit}</i></span>
            <span class="dw-arrow">›</span>
          </button>

          <button class="dw-item" data-go="note">
            <span class="dw-ico sky">${ICON.note}</span>
            <span class="dw-text"><b>记事本</b><i>${noteCount ? `${noteCount} 个在跟踪的想法` : '记录你的项目与灵感'}</i></span>
            <span class="dw-arrow">›</span>
          </button>
        </div>

        <div class="dw-group">
          <button class="dw-item" data-go="timeline">
            <span class="dw-ico butter">${ICON.time}</span>
            <span class="dw-text"><b>时间轴</b><i>按周回看做过什么</i></span>
            <span class="dw-arrow">›</span>
          </button>
          <button class="dw-item" data-act="ai">
            <span class="dw-ico sky">${ICON.ai}</span>
            <span class="dw-text"><b>AI 语义解析</b><i>${s.apiKey ? '已配置 · 云端增强' : '未配置 · 本地规则模式'}</i></span>
            <span class="dw-arrow">›</span>
          </button>
          <button class="dw-item" data-act="export">
            <span class="dw-ico peach">${ICON.export}</span>
            <span class="dw-text"><b>导出备份</b><i>全部数据存本机，随时带走</i></span>
            <span class="dw-arrow">›</span>
          </button>
        </div>

        <div class="dw-foot">数据只存在这台设备上 · v0.2</div>
      </div>
    </div>`);

  host.appendChild(mask);
  requestAnimationFrame(() => mask.classList.add('in'));

  const close = () => {
    mask.classList.remove('in');
    setTimeout(() => mask.remove(), 260);
  };

  mask.addEventListener('click', (e) => {
    if (e.target === mask) return close();

    const goTo = e.target.closest('[data-go]')?.dataset.go;
    if (goTo === 'ledger') { close(); return go('ledger'); }
    if (goTo === 'wish')   { close(); return go('wish'); }
    if (goTo === 'todo')   { close(); return go('todo'); }
    if (goTo === 'note')   { close(); return go('note'); }
    if (goTo === 'timeline') { close(); return go('timeline'); }

    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'ai') { close(); return go('settings'); }
    if (act === 'settings') { close(); return go('settings'); }
    if (act === 'export') {
      const blob = new Blob([exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `个人管理备份-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('备份已下载');
    }
  });
}
