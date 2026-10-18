// Página de rolagem não encontrada: um d20 perdido girando devagar, só com runas (nenhum número).
import { Tray } from './ui.js';
import { setupShell } from './shell.js';

const tray = new Tray(document.getElementById('tray'), 20, 1);
tray.tumble();
for (const die of tray.dice) die.omega = 1.4;
setupShell();
