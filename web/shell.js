// Comportamento comum das páginas: cabeçalho que vira vidro ao rolar, aviso sem conexão e cards que
// inclinam seguindo o ponteiro. Só exibição; nenhuma regra de negócio.
import { reducedMotion, toast } from './ui.js';

/** Vidro no cabeçalho quando a página sai do topo (sentinela no topo do body). */
function glassHeader() {
  const sentinel = document.querySelector('.scroll-sentinel');
  if (!sentinel || typeof IntersectionObserver !== 'function') return;
  new IntersectionObserver(([entry]) => {
    document.body.classList.toggle('is-scrolled', !entry.isIntersecting);
  }).observe(sentinel);
}

/** Faixa enquanto não há conexão; um aviso quando ela volta. */
function connectionNotice() {
  const notice = document.getElementById('offline');
  if (!notice) return;
  const render = () => {
    notice.hidden = navigator.onLine !== false;
  };
  addEventListener('offline', render);
  addEventListener('online', () => {
    render();
    toast('Conexão de volta', 'ok');
  });
  render();
}

const MAX_TILT = 6;

/** Cards [data-tilt]: até 6° de inclinação e um brilho onde está o ponteiro (só mouse). */
function tiltCards() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  for (const card of document.querySelectorAll('[data-tilt]')) {
    let frame = 0;
    card.addEventListener('pointermove', (event) => {
      if (reducedMotion()) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = card.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width;
        const y = (event.clientY - box.top) / box.height;
        card.classList.add('is-tilting');
        card.style.setProperty('--ry', `${((x - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
        card.style.setProperty('--rx', `${((0.5 - y) * 2 * MAX_TILT).toFixed(2)}deg`);
        card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      card.classList.remove('is-tilting');
      for (const k of ['--rx', '--ry']) card.style.setProperty(k, '0deg');
      card.style.setProperty('--gx', '50%');
      card.style.setProperty('--gy', '0%');
    });
  }
}

export function setupShell() {
  glassHeader();
  connectionNotice();
  tiltCards();
}
