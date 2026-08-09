/* ============================================================
   模块 1 · 首页（已锁定方案 C）
   顶部：汉堡 + 可编辑问候语
   中部：今日概览（待办具体条目 + 弱化收支）
   底部：微信式输入栏（文本回车发送 / 语音按住说话松手发送）
   ============================================================ */
import { h, esc, toast, editSheet } from '../utils/dom.js';
import { friendlyDate } from '../utils/time.js';
import { todayDigest, getSettings, setSetting, saveRecord, allRecords } from '../store.js';
import { parse } from '../ai/parser.js';
import { isSupported, createRecognizer } from '../speech.js';
import { openDrawer } from './drawer.js';
import { go } from '../router.js';

const MIC_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" style="color:var(--pink-400)">
  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>`;

const KEY_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" style="color:var(--lav-500)">
  <rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>`;

export function HomeView() {
  const s = getSettings();
  const d = todayDigest();
  const nick = s.nickname || '朋友';

  const todoHTML = d.todos.length
    ? d.todos.map(t => `
        <div class="todo-row ${t.done ? 'done' : ''}" data-id="${t.id}">
          <div class="todo-check">✓</div>
          <div class="todo-text">${esc(t.title)}</div>
          <div class="energy-dot ${t.energy || 'mid'}"></div>
        </div>`).join('')
    : `<div class="ov-empty">今天还没有待办 · 说点什么就记下了</div>`;

  const topExpHTML = d.topExp
    ? `<span class="top-exp">最大 ¥${d.topExp.amount} · ${esc(d.topExp.category || '')}</span>`
    : '';

  const el = h(`
    <div>
      <div class="topbar">
        <button class="hamburger" data-act="drawer"><i></i><i></i><i></i></button>
        <div class="greeting" data-act="nick">
          嗨，<span class="nick">${esc(nick)}</span><span class="edit-pen">✎</span>
        </div>
      </div>

      <div class="scroll">
        <div class="overview">
          <div class="ov-head">
            <span class="ov-title">今日概览</span>
            <span class="ov-date">${friendlyDate()}</span>
          </div>
          <div class="todo-list">${todoHTML}</div>
          <div class="ov-money">
            <span class="exp">支出 <b>¥${d.expense.toFixed(2)}</b></span>
            <span class="inc">收入 <b>¥${d.income.toFixed(2)}</b></span>
            ${topExpHTML}
          </div>
        </div>
      </div>

      <div class="inputbar">
        <div class="input-wrap">
          <input type="text" placeholder="记点什么…" enterkeyhint="send">
        </div>
        <button class="hold-btn" hidden>按住说话</button>
        <button class="voice-btn" data-act="toggle-voice">${MIC_SVG}</button>
      </div>
    </div>`);

  const inputWrap = el.querySelector('.input-wrap');
  const input     = el.querySelector('.input-wrap input');
  const holdBtn   = el.querySelector('.hold-btn');
  const voiceBtn  = el.querySelector('.voice-btn');

  /* —— 文本模式：回车发送 —— */
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && input.value.trim()) {
      submit(input.value.trim());
      input.value = '';
    }
  });

  /* —— 切换语音 / 文本模式 —— */
  let voiceMode = false;
  voiceBtn.addEventListener('click', () => {
    voiceMode = !voiceMode;
    inputWrap.hidden = voiceMode;
    holdBtn.hidden = !voiceMode;
    voiceBtn.classList.toggle('active', voiceMode);
    voiceBtn.innerHTML = voiceMode ? KEY_SVG : MIC_SVG;
    if (!voiceMode) input.focus();
  });

  /* —— 语音模式：按住说话，松手即发送 —— */
  let recognizer = null, overlay = null, heardText = '';

  const startHold = (e) => {
    e.preventDefault();
    if (!isSupported()) {
      toast('当前浏览器不支持语音识别，请用 Chrome/Edge');
      return;
    }
    holdBtn.classList.add('holding');
    holdBtn.textContent = '松开发送';
    heardText = '';

    overlay = h(`
      <div class="rec-overlay">
        <div class="rec-card">
          <div class="rec-wave"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="rec-text">在听…</div>
        </div>
      </div>`);
    document.getElementById('app').appendChild(overlay);

    recognizer = createRecognizer({
      onPartial: (t) => {
        heardText = t;
        if (overlay) overlay.querySelector('.rec-text').textContent = t || '在听…';
      },
      onFinal: (t) => { if (t) heardText = t; },
      onError: (err) => {
        toast(err === 'not-allowed' ? '需要开启麦克风权限' : `语音出错：${err}`);
      },
    });
    recognizer?.start();
  };

  const endHold = (e) => {
    e?.preventDefault();
    if (!recognizer) return;
    holdBtn.classList.remove('holding');
    holdBtn.textContent = '按住说话';
    recognizer.stop();
    recognizer = null;

    setTimeout(() => {
      overlay?.remove(); overlay = null;
      const t = heardText.trim();
      if (t) submit(t); else toast('没听清，再说一次试试～');
    }, 420);
  };

  holdBtn.addEventListener('touchstart', startHold, { passive: false });
  holdBtn.addEventListener('touchend', endHold);
  holdBtn.addEventListener('touchcancel', endHold);
  holdBtn.addEventListener('mousedown', startHold);
  holdBtn.addEventListener('mouseup', endHold);
  holdBtn.addEventListener('mouseleave', (e) => { if (recognizer) endHold(e); });

  /* —— 顶部交互 —— */
  el.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;

    if (act === 'nick') {
      const v = await editSheet({ title: '怎么称呼你？', value: getSettings().nickname, placeholder: '留空则显示「朋友」' });
      if (v !== null) { setSetting({ nickname: v }); go('home', {}, { replace: true }); }
    }
    if (act === 'drawer') {
      openDrawer();
    }

    // 勾选待办
    const row = e.target.closest('.todo-row');
    if (row) {
      const rec = allRecords().find(r => r.id === row.dataset.id);
      if (rec) { rec.done = !rec.done; saveRecord(rec); go('home', {}, { replace: true }); }
    }
  });

  setTimeout(() => input.focus(), 120);
  return el;
}

/* —— 发送：解析 → 自动跳转结果页 —— */
async function submit(text) {
  const host = document.getElementById('app');
  const think = h(`
    <div class="thinking">
      <div class="think-dots"><span></span><span></span><span></span></div>
      <div class="think-text">正在读懂你说的话…</div>
      <div class="think-src"></div>
    </div>`);
  host.appendChild(think);

  const srcEl = think.querySelector('.think-src');
  try {
    const result = await parse(text, (stage) => {
      srcEl.textContent = stage === 'cloud' ? '交给 AI 精修…' : '本地快速识别…';
    });
    think.remove();
    go('result', { draft: result });
  } catch (err) {
    think.remove();
    toast('识别失败：' + err.message);
  }
}
