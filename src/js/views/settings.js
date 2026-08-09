/* ============================================================
   模块 6 · 完整设置页
   个人资料 / 外观(字体·背景·语言) / 精力与周期 / 提醒 / AI 语义解析
   ============================================================ */
import { h, esc, toast } from '../utils/dom.js';
import { getSettings, setSetting, applyAppTheme, FONT_TIERS, BG_THEMES } from '../store.js';
import { testKey } from '../ai/deepseek.js';
import { go, back } from '../router.js';

const money = (n) => '¥' + (Math.round(n * 100) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FONTS = [
  { id:'s', label:'小' },
  { id:'m', label:'标准' },
  { id:'l', label:'大' },
];
const WEEKS = [
  { id:1, label:'周一' },
  { id:0, label:'周日' },
];
const LANGS = [
  { id:'zh-CN', label:'简体中文', ok:true },
  { id:'zh-TW', label:'繁體中文', ok:false },
  { id:'en',    label:'English',  ok:false },
];

export function SettingsView() {
  const s = getSettings();
  const host = document.getElementById('app');
  const el = h(`
    <div class="settings">
      <div class="topbar">
        <button class="topbar-back" data-act="back">‹</button>
        <span class="topbar-title">设置</span>
        <span style="width:40px"></span>
      </div>

      <div class="scroll">

        <!-- 个人资料 -->
        <div class="set-sec">
          <div class="set-sec-title">个人资料</div>
          <div class="set-card set-profile">
            <div class="set-avatar" id="avatar">${esc((s.nickname || '朋').slice(0, 1))}</div>
            <div class="set-profile-main">
              <div class="set-label">昵称</div>
              <input class="set-input" id="nick" maxlength="12" placeholder="朋友"
                     value="${esc(s.nickname)}" autocomplete="off">
            </div>
          </div>
        </div>

        <!-- 外观 -->
        <div class="set-sec">
          <div class="set-sec-title">外观</div>

          <div class="set-card">
            <div class="set-row">
              <span class="set-label">字体大小</span>
              <div class="chips" data-grp="font">
                ${FONTS.map(f => `<button class="chip ${s.fontSize === f.id ? 'on lav' : ''}" data-id="${f.id}">${f.label}</button>`).join('')}
              </div>
            </div>
            <div class="set-div"></div>
            <div class="set-row">
              <span class="set-label">背景主题</span>
              <div class="chips" data-grp="bg">
                ${BG_THEMES.map(b => `<button class="chip ${s.bgTheme === b.id ? 'on pink' : ''}" data-id="${b.id}"><i class="set-bg-dot" style="background:${b.css}"></i>${b.label}</button>`).join('')}
              </div>
            </div>
            <div class="set-div"></div>
            <div class="set-row">
              <span class="set-label">语言</span>
              <div class="chips" data-grp="lang">
                ${LANGS.map(l => `<button class="chip ${s.lang === l.id ? 'on mint' : ''} ${l.ok ? '' : 'disabled'}" data-id="${l.id}" ${l.ok ? '' : 'disabled'}>${l.label}${l.ok ? '' : ' · 即将上线'}</button>`).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- 精力与周期 -->
        <div class="set-sec">
          <div class="set-sec-title">精力与周期</div>
          <div class="set-card">
            <div class="set-row">
              <span class="set-label">每日精力上限</span>
              <div class="stepper">
                <button class="step-btn" data-act="dec">−</button>
                <span class="step-val" id="limit">${s.energyLimit}</span>
                <button class="step-btn" data-act="inc">＋</button>
              </div>
            </div>
            <div class="set-div"></div>
            <div class="set-row">
              <span class="set-label">一周起始</span>
              <div class="chips" data-grp="week">
                ${WEEKS.map(w => `<button class="chip ${s.weekStart === w.id ? 'on lav' : ''}" data-id="${w.id}">${w.label}</button>`).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- 提醒 -->
        <div class="set-sec">
          <div class="set-sec-title">提醒</div>
          <div class="set-card">
            <div class="set-row">
              <div>
                <div class="set-label">超上限推送</div>
                <div class="set-hint">安排超过每日精力时温柔提醒你</div>
              </div>
              <button class="switch ${s.pushEnabled ? 'on' : ''}" data-act="push"><i></i></button>
            </div>
          </div>
        </div>

        <!-- AI 语义解析 -->
        <div class="set-sec">
          <div class="set-sec-title">AI 语义解析</div>
          <div class="set-card">
            <div class="set-hint" style="margin-bottom:12px">
              填入 DeepSeek 的 API Key，识别会明显更准（能听懂「在国广吃安寿司」这种复杂句）。不填也能用 —— 本地规则引擎会兜底，完全离线。
            </div>
            <input class="set-input full" id="key" type="password" placeholder="sk-…"
                   value="${esc(s.apiKey)}" autocomplete="off" spellcheck="false">
            <div class="set-row" style="margin-top:14px">
              <span class="set-label">启用云端解析</span>
              <button class="switch ${s.aiEnabled ? 'on' : ''}" data-act="ai"><i></i></button>
            </div>
            <div class="set-div"></div>
            <div class="set-row">
              <span class="set-label">AI 自动预估精力</span>
              <button class="switch ${s.aiEstimateEnergy ? 'on' : ''}" data-act="est"><i></i></button>
            </div>
            <div id="aiStatus" class="set-hint" style="min-height:18px;margin:12px 0 4px"></div>
            <button class="btn btn-ghost full" data-act="test">测试连接</button>
          </div>
        </div>

        <div class="set-foot">数据只存在这台设备上 · 当前 v0.3</div>
      </div>
    </div>`);

  // —— 昵称 ——
  const nick = el.querySelector('#nick');
  const avatar = el.querySelector('#avatar');
  nick.addEventListener('input', () => {
    const v = nick.value.trim();
    avatar.textContent = (v || '朋').slice(0, 1);
    setSetting({ nickname: v });
    applyAppTheme();
  });

  // —— chip 组（字体 / 背景 / 语言 / 周起始）——
  el.querySelectorAll('.chips[data-grp]').forEach(grp => {
    const name = grp.dataset.grp;
    grp.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled) return;
      const id = btn.dataset.id;
      const map = { font:'fontSize', bg:'bgTheme', lang:'lang', week:'weekStart' };
      const patch = {}; patch[map[name]] = (name === 'week') ? Number(id) : id;
      setSetting(patch);
      applyAppTheme();
      grp.querySelectorAll('.chip').forEach(c => c.classList.remove('on', 'lav', 'pink', 'mint'));
      const onCls = { font:'lav', bg:'pink', lang:'mint', week:'lav' }[name];
      btn.classList.add('on', onCls);
      if (name === 'lang') toast('语言切换将在后续版本完整支持');
    });
  });

  // —— 精力上限 stepper ——
  const limitEl = el.querySelector('#limit');
  el.querySelector('[data-act="inc"]').addEventListener('click', () => {
    const v = Math.min(20, (+limitEl.textContent) + 1);
    limitEl.textContent = v; setSetting({ energyLimit: v }); toast('已更新每日精力上限');
  });
  el.querySelector('[data-act="dec"]').addEventListener('click', () => {
    const v = Math.max(4, (+limitEl.textContent) - 1);
    limitEl.textContent = v; setSetting({ energyLimit: v }); toast('已更新每日精力上限');
  });

  // —— 开关组 ——
  const bindSwitch = (act, key) => {
    const sw = el.querySelector(`[data-act="${act}"]`);
    sw.addEventListener('click', () => {
      const on = !sw.classList.contains('on');
      sw.classList.toggle('on', on);
      setSetting({ [key]: on });
      toast(on ? '已开启' : '已关闭');
    });
  };
  bindSwitch('push', 'pushEnabled');
  bindSwitch('ai', 'aiEnabled');
  bindSwitch('est', 'aiEstimateEnergy');

  // —— AI 测试连接 ——
  const key = el.querySelector('#key');
  const status = el.querySelector('#aiStatus');
  el.querySelector('[data-act="test"]').addEventListener('click', async () => {
    const k = key.value.trim();
    if (!k) { status.textContent = '先填 Key 再测'; status.style.color = 'var(--text-3)'; return; }
    status.textContent = '正在连接 DeepSeek…'; status.style.color = 'var(--text-2)';
    const r = await testKey(k, s.apiModel);
    status.innerHTML = r.ok
      ? '<span style="color:var(--mint-500)">连通正常，可以用了 ✓</span>'
      : `<span style="color:var(--pink-400)">${esc(r.msg)}</span>`;
  });

  // —— 返回 ——
  el.querySelector('[data-act="back"]').addEventListener('click', () => back());

  return el;
}
