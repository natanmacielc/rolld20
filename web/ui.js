// Peças visuais compartilhadas: dados 3D (de dice3d/), aro do tablado, diálogos, avisos e checklist.
// Sem regra de negócio e sem innerHTML: todo texto entra por textContent.

import { dieIcon } from './dice3d/icon.js';
import { DIE_COLORS, DIE_SIDES } from './dice3d/shade.js';
import { Tray } from './dice3d/tray.js';

export { DIE_COLORS, DIE_SIDES, Tray, dieIcon };

const SVG_NS = 'http://www.w3.org/2000/svg';

export const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const $ = (id) => document.getElementById(id);

/** Cria um elemento. Strings em children viram nós de texto (nunca HTML). */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Ícone de traço (24×24, mesmo estilo dos botões): um path por string. */
export function lineIcon(...paths) {
  const icon = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  icon.append(...paths.map((d) => svg('path', { d })));
  return icon;
}

/**
 * QR em SVG: um path só, com margem de 4 módulos e sem estilo inline (o CSP proíbe).
 * qr é o objeto do qrcode-generator (web/vendor) já com make().
 */
export function qrSvg(qr, label) {
  const n = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(row, col)) d += `M${col + 4} ${row + 4}h1v1h-1z`;
    }
  }
  const icon = svg('svg', { viewBox: `0 0 ${n + 8} ${n + 8}`, class: 'qr', role: 'img', 'aria-label': label, 'shape-rendering': 'crispEdges' });
  icon.append(svg('rect', { class: 'qr-bg', width: n + 8, height: n + 8 }), svg('path', { class: 'qr-dots', d }));
  return icon;
}

// ---------- Efeitos ----------

/** Conta de 0 até o valor. */
export function countUp(el, to, ms = 700) {
  if (reducedMotion() || ms <= 0) {
    el.textContent = String(to);
    return;
  }
  const start = performance.now();
  const from = 0;
  const frame = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const e = 1 - (1 - t) ** 3;
    el.textContent = String(Math.round(from + (to - from) * e));
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

const RING_TICKS = 36;

/**
 * Aro do tablado: enche de luz até o round alvo (0..1), com as marcas acendendo uma a uma, e
 * modos idle/waiting/done. As marcas são criadas aqui para o HTML ficar enxuto.
 */
export function ring(root) {
  const progress = root.querySelector('.ring-progress');
  const ticks = root.querySelector('.ring-ticks');
  const marks = [];
  if (ticks && !ticks.childElementCount) {
    for (let i = 0; i < RING_TICKS; i++) {
      const a = (i / RING_TICKS) * Math.PI * 2 - Math.PI / 2;
      const [r1, r2] = i % 3 === 0 ? [41.2, 44.8] : [42.2, 44];
      const mark = svg('line', {
        x1: (50 + r1 * Math.cos(a)).toFixed(2), y1: (50 + r1 * Math.sin(a)).toFixed(2),
        x2: (50 + r2 * Math.cos(a)).toFixed(2), y2: (50 + r2 * Math.sin(a)).toFixed(2),
      });
      marks.push(mark);
      ticks.append(mark);
    }
  }
  let lit = -1;
  return {
    mode(m) {
      root.dataset.mode = m;
      if (m === 'idle') this.progress(0);
    },
    progress(p) {
      const v = Math.max(0, Math.min(1, p));
      progress.style.setProperty('stroke-dashoffset', String(100 - v * 100));
      const n = Math.round(v * marks.length);
      if (n === lit) return;
      lit = n;
      marks.forEach((mark, i) => mark.classList.toggle('is-lit', i < n));
    },
  };
}

// ---------- Diálogos e avisos ----------

const phoneSheet = () => globalThis.matchMedia?.('(max-width: 40rem)').matches ?? false;
let openCount = 0;
const openers = new WeakMap();

/**
 * Liga botões [data-open] e [data-close] aos <dialog>. Clique no fundo fecha (mas não um arraste
 * que começou dentro da folha); no celular, as folhas fecham arrastando para baixo.
 */
export function setupDialogs() {
  document.addEventListener('click', (event) => {
    const opener = event.target.closest?.('[data-open]');
    if (opener) openDialog($(opener.dataset.open), opener);
    const closer = event.target.closest?.('[data-close]');
    if (closer) closeDialog(closer.closest('dialog'));
  });
  for (const dialog of document.querySelectorAll('dialog')) {
    let downOnBackdrop = false;
    dialog.addEventListener('pointerdown', (event) => {
      downOnBackdrop = event.target === dialog;
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && downOnBackdrop) closeDialog(dialog);
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog(dialog);
    });
    dialog.addEventListener('close', () => {
      openCount = Math.max(0, openCount - 1);
      document.documentElement.classList.toggle('has-dialog', openCount > 0);
      const back = openers.get(dialog);
      if (back?.isConnected) back.focus?.({ preventScroll: true });
    });
    if (dialog.classList.contains('sheet') || dialog.classList.contains('drawer')) dragToClose(dialog);
  }
}

/** Arrastar a alça (ou o cabeçalho) para baixo fecha a folha no celular. */
function dragToClose(dialog) {
  const grip = dialog.querySelector('.sheet-head');
  if (!grip) return;
  let start = null;
  const move = (event) => {
    if (!start) return;
    const dy = Math.max(0, event.clientY - start.y);
    dialog.style.setProperty('--drag', `${dy}px`);
  };
  const end = (event) => {
    if (!start) return;
    const dy = Math.max(0, event.clientY - start.y);
    const speed = dy / Math.max(1, performance.now() - start.t);
    start = null;
    dialog.classList.remove('is-dragging');
    if (dy > 110 || speed > 0.6) {
      closeDialog(dialog, true);
    } else {
      dialog.style.setProperty('--drag', '0px');
    }
  };
  grip.addEventListener('pointerdown', (event) => {
    if (!phoneSheet() || dialog.classList.contains('drawer') || event.target.closest('button, a, input')) return;
    start = { y: event.clientY, t: performance.now() };
    dialog.classList.add('is-dragging');
    grip.setPointerCapture?.(event.pointerId);
  });
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
}

export function openDialog(dialog, opener = document.activeElement) {
  if (!dialog || dialog.open) return;
  dialog.classList.remove('is-closing');
  dialog.style.setProperty('--drag', '0px');
  if (opener instanceof HTMLElement) openers.set(dialog, opener);
  dialog.showModal();
  openCount += 1;
  document.documentElement.classList.add('has-dialog');
  dialog.dispatchEvent(new Event('opened'));
}

export function closeDialog(dialog, dragged = false) {
  if (!dialog?.open || dialog.classList.contains('is-closing')) return;
  if (reducedMotion()) {
    dialog.close();
    return;
  }
  dialog.classList.add('is-closing');
  if (dragged) dialog.classList.add('is-dropped');
  setTimeout(() => {
    dialog.classList.remove('is-closing', 'is-dropped');
    dialog.close();
  }, 240);
}

let toastTimer = null;
/** Aviso curto embaixo da tela. kind: 'ok', 'warn' ou nada. */
export function toast(message, kind = '') {
  let el = $('toast');
  if (!el) {
    el = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' },
      h('span', { class: 'toast-icon', 'aria-hidden': 'true' }), h('span', { class: 'toast-text' }));
    document.body.append(el);
  }
  el.dataset.kind = kind;
  el.querySelector('.toast-text').textContent = message;
  el.classList.remove('is-visible');
  void el.offsetWidth;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

export async function copyText(text, message = 'Copiado!') {
  try {
    await navigator.clipboard.writeText(text);
    toast(message, 'ok');
  } catch {
    toast('Não deu para copiar. Selecione e copie à mão.', 'warn');
  }
}

/** Compartilha pelo menu nativo; sem ele, copia o link. */
export async function shareLink(url, title) {
  if (navigator.share) {
    try {
      await navigator.share({ url, title });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  await copyText(url, 'Link copiado!');
}

/** Botão de copiar ao lado de um valor. */
export function copyButton(value, label = 'Copiar') {
  return h('button', { type: 'button', class: 'copy', 'aria-label': `${label}: ${value}`, onclick: () => copyText(value) }, 'Copiar');
}

// ---------- Verificação ----------

const ICON_OK = 'M5 12.5l4.5 4.5L19 7.5';
const ICON_FAIL = 'M7 7l10 10M17 7L7 17';

function checkIcon(ok) {
  const icon = svg('svg', { viewBox: '0 0 24 24', class: 'check-icon', 'aria-hidden': 'true' });
  icon.append(svg('path', { d: ok ? ICON_OK : ICON_FAIL, pathLength: 1 }));
  return icon;
}

/** Lista do checklist, um item acendendo depois do outro. */
export function renderChecks(list, checks) {
  list.replaceChildren(...checks.map((c, i) => {
    const item = h('li', { class: `check ${c.ok ? 'is-ok' : 'is-fail'}` },
      h('span', { class: 'check-mark' }, checkIcon(c.ok)),
      h('span', { class: 'check-text' }, h('strong', { text: c.label }), h('span', { text: c.detail })));
    item.style.setProperty('--i', String(i));
    return item;
  }));
}

/**
 * Selo de verificação: roda o checklist e, ao clicar, abre o diálogo com o detalhe.
 * dialog precisa ter #verify-title, #verify-checks, #verify-verdict e links [data-roll-link].
 */
export async function runVerificationBadge(badge, dialog, rollId, verifyRoll) {
  badge.hidden = false;
  badge.dataset.state = 'running';
  badge.querySelector('.badge-text').textContent = 'Conferindo no seu navegador…';
  for (const a of dialog.querySelectorAll('[data-roll-link]')) {
    a.href = a.dataset.rollLink.replace('{id}', rollId);
  }
  dialog.querySelector('#verify-checks').replaceChildren(h('li', { class: 'check is-running', text: 'Conferindo…' }));
  dialog.querySelector('#verify-verdict').textContent = '';
  const { proof, checks } = await verifyRoll(rollId);
  const ok = checks.every((c) => c.ok);
  badge.dataset.state = ok ? 'ok' : 'fail';
  badge.querySelector('.badge-text').textContent = ok ? 'Conferido no seu navegador' : 'Falhou na conferência';
  renderChecks(dialog.querySelector('#verify-checks'), checks);
  dialog.dataset.state = ok ? 'ok' : 'fail';
  dialog.querySelector('#verify-title').textContent = ok ? 'Tudo confere' : 'Atenção: algo não confere';
  dialog.querySelector('#verify-verdict').textContent = ok
    ? 'Este resultado veio de um número público do drand que ainda não existia quando você rolou. Ninguém, nem o servidor, podia prever ou escolher.'
    : 'Alguma conferência falhou. Não confie neste resultado até entender o motivo.';
  return { proof, checks, ok };
}

// ---------- Resultado ----------

/**
 * Momento do resultado: clarão no tablado e centelhas nos dados; no crítico, coluna de luz dourada
 * e faixa; na falha crítica, tremulação vermelha e dois tremores curtos. Tudo some em ~1 s.
 */
export function celebrate(stage, banner, crit, tray) {
  banner.hidden = true;
  stage.classList.remove('is-crit', 'is-fumble');
  replay(stage, 'is-landed');
  tray?.flare(crit);
  if (!crit) return;
  stage.classList.add(crit === 'crit' ? 'is-crit' : 'is-fumble');
  if (crit === 'fumble') {
    stage.classList.add('is-shaking');
    setTimeout(() => stage.classList.remove('is-shaking'), 520);
  }
  banner.textContent = crit === 'crit' ? 'Crítico!' : 'Falha crítica';
  banner.dataset.kind = crit;
  banner.hidden = false;
  replay(banner, 'is-in');
}

/**
 * Fichas dos dados sob o total (máximo em ouro, 1 em vermelho) e o bônus. `text` é a mesma conta
 * por extenso, para leitor de tela. Um dado só sem bônus não tem fichas: o total já diz tudo.
 */
export function diceChips(el, { dice, modifier = 0, sides, text }) {
  if (!text) {
    el.replaceChildren();
    el.removeAttribute('aria-label');
    return;
  }
  const max = sides === 100 ? 100 : sides;
  const chips = dice.map((d, i) => {
    const chip = h('span', { class: `die-chip${d === max ? ' is-max' : d === 1 ? ' is-min' : ''}`, 'aria-hidden': 'true', text: String(d) });
    chip.style.setProperty('--i', String(Math.min(i, 12)));
    return chip;
  });
  const mod = modifier ? [h('span', { class: 'mod-chip', 'aria-hidden': 'true', text: `${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}` })] : [];
  el.replaceChildren(...chips, ...mod, h('span', { class: 'visually-hidden', text }));
}

/** Tira o brilho do resultado anterior do tablado. */
export function calmStage(stage, banner) {
  stage.classList.remove('is-crit', 'is-fumble', 'is-landed');
  banner.hidden = true;
}

/** Reinicia uma animação de entrada baseada em classe. */
export function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "Verificar a mesa inteira": elos acendendo e o veredito. */
export async function runTableCheck({ button, chain, out }, sessionId, verifyTable) {
  button.disabled = true;
  chain.hidden = false;
  chain.dataset.state = 'running';
  chain.replaceChildren(...Array.from({ length: 24 }, (_, i) => {
    const link = h('span', { class: 'chain-link' });
    link.style.setProperty('--i', String(i));
    return link;
  }));
  out.className = 'chain-result';
  out.textContent = 'Baixando e conferindo cada elo da cadeia…';
  try {
    const [{ result, summary }] = await Promise.all([verifyTable(sessionId), sleep(reducedMotion() ? 0 : 1100)]);
    chain.dataset.state = result.valid ? 'ok' : 'fail';
    out.classList.add(result.valid ? 'is-ok' : 'is-fail');
    out.textContent = result.valid
      ? `Cadeia íntegra desde a primeira entrada: ${count(summary.requests, 'pedido', 'pedidos')}, ${count(summary.resolved, 'resolvido', 'resolvidos')}, ${count(summary.pending.length, 'pendente', 'pendentes')}. Nada foi apagado nem alterado.`
      : `Cadeia inválida: ${result.code} (${result.message})`;
  } catch (e) {
    chain.dataset.state = 'fail';
    out.classList.add('is-fail');
    out.textContent = e.message;
  } finally {
    button.disabled = false;
  }
}
