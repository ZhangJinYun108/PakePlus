import { register, mount, go } from './router.js';
import { HomeView } from './views/home.js';
import { ResultView } from './views/result.js';
import { LedgerView } from './views/ledger.js';
import { WishView } from './views/wish.js';
import { TodoView } from './views/todo.js';
import { NoteView } from './views/note.js';
import { SettingsView } from './views/settings.js';
import { TimelineView } from './views/timeline.js';

register('home', HomeView);
register('result', ResultView);
register('ledger', LedgerView);
register('wish', WishView);
register('todo', TodoView);
register('note', NoteView);
register('settings', SettingsView);
register('timeline', TimelineView);

mount(document.getElementById('app'));

// 启动即套用已保存的外观主题（字体档 / 背景）
import { applyAppTheme } from './store.js';
applyAppTheme();

// 开发调试入口：?demo=result|voice|ledger|drawer
const p = new URLSearchParams(location.search);
const demo = p.get('demo');

if (demo === 'result') {
  go('result', { draft: JSON.parse(p.get('draft')) });
} else if (demo === 'ledger') {
  go('ledger', { period: p.get('period') || 'month' });
} else if (demo === 'wish') {
  go('wish');
} else if (demo === 'todo') {
  go('todo');
} else if (demo === 'note') {
  go('note');
} else if (demo === 'settings') {
  go('settings');
} else if (demo === 'timeline') {
  go('timeline');
} else {
  go('home');
  if (demo === 'voice') {
    setTimeout(() => document.querySelector('.voice-btn')?.click(), 80);
  } else if (demo === 'drawer') {
    import('./views/drawer.js').then(m => setTimeout(m.openDrawer, 80));
  }
}

// 移动端：阻止双指缩放与下拉刷新，贴近原生手感
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
