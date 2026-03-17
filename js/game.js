/* ═══════════════════════════════════════════════════════════════════════════
   RICARDO TORMO PARTY — game.js
   Motor completo del juego estilo Mario Party
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────────────────────────────────
   1. CONFIGURACIÓN GLOBAL
   ────────────────────────────────────────────────────────────────────────── */

/** Número total de casillas en el tablero (0 = salida, 49 = meta) */
const TOTAL_CELLS = 50;

/** Cada cuántas casillas totales recorridas se activa un evento aleatorio */
const EVENT_INTERVAL = 8;

/** Dimensiones del viewBox SVG del tablero */
const SVG_W = 1000;
const SVG_H = 560;

/** Casillas por fila en el tablero serpentina */
const CELLS_PER_ROW = 10;

/** Número de filas */
const NUM_ROWS = 5;

/** Celda que contiene el power-up verde (única en todo el tablero) */
const GREEN_CELL = 24;

/**
 * Colores de casilla.
 * Modifica aquí para cambiar el esquema de colores.
 */
const CELL_COLORS = {
  white:  '#FFFFFF',
  red:    '#FF4B4B',
  yellow: '#FFD93D',
  green:  '#4CAF50',
  start:  '#2196F3',
  finish: '#FF9800',
};

/**
 * Distribución de tipos de casilla.
 * Modifica los porcentajes aquí para cambiar la dificultad.
 */
const CELL_TYPE_WEIGHTS = {
  white:  0.55,   // 55 % sin efecto
  red:    0.25,   // 25 % efecto negativo
  yellow: 0.20,   // 20 % efecto positivo
};

/* ──────────────────────────────────────────────────────────────────────────
   2. DEFINICIÓN DE PERSONAJES
   Para añadir/quitar personajes edita solo este array.
   ────────────────────────────────────────────────────────────────────────── */

/** Lista completa de personajes jugables */
const CHARACTERS = [
  {
    id: 'alien',
    name: 'Alien',
    emoji: '👽',
    color: '#A8EDAA',
    image: 'assets/characters/alien.png',
    powerupName: 'Xenomorph Sorpresa',
    powerupDesc: 'Paraliza a jugadores adyacentes 1 turno y avanza 5 casillas',
    /**
     * Aplica el power-up del Alien.
     * @param {object} actor  - jugador que activa el power-up
     * @param {object} state  - estado global del juego
     */
    applyPowerup(actor, state) {
      let paralyzed = [];
      state.players.forEach(p => {
        if (p.id !== actor.id) {
          const dist = Math.abs(p.position - actor.position);
          if (dist <= 3) {
            p.skipTurns = (p.skipTurns || 0) + 1;
            paralyzed.push(p.name);
          }
        }
      });
      actor.position = Math.min(actor.position + 5, TOTAL_CELLS - 1);
      const msg = paralyzed.length
        ? `${actor.name} paraliza a ${paralyzed.join(', ')} y avanza 5 casillas!`
        : `${actor.name} activa Xenomorph Sorpresa y avanza 5 casillas!`;
      addLog(msg, 'powerup');
      return msg;
    },
  },
  {
    id: 'desdentao',
    name: 'Desdentao',
    emoji: '😬',
    color: '#F9C74F',
    image: 'assets/characters/desdentao.png',
    powerupName: 'Vuelo Supersónico',
    powerupDesc: 'Salta hasta 3 casillas sobre un jugador sin sufrir efectos negativos',
    applyPowerup(actor, state) {
      // Busca jugador más cercano por delante
      let target = null;
      let minDist = Infinity;
      state.players.forEach(p => {
        if (p.id !== actor.id && p.position > actor.position) {
          const d = p.position - actor.position;
          if (d < minDist) { minDist = d; target = p; }
        }
      });
      if (target) {
        const jump = target.position + Math.floor(Math.random() * 3) + 1;
        actor.position = Math.min(jump, TOTAL_CELLS - 1);
        actor.immuneNextCell = true; // no aplica efecto de la casilla de aterrizaje
        const msg = `${actor.name} vuela sobre ${target.name} y aterriza en casilla ${actor.position}!`;
        addLog(msg, 'powerup');
        return msg;
      }
      // Sin jugador delante: avanza 3
      actor.position = Math.min(actor.position + 3, TOTAL_CELLS - 1);
      const msg = `${actor.name} activa Vuelo Supersónico y avanza 3 casillas!`;
      addLog(msg, 'powerup');
      return msg;
    },
  },
  {
    id: 'marc_marquez',
    name: 'Marc Márquez',
    emoji: '🏍️',
    color: '#F72585',
    image: 'assets/characters/marc_marquez.png',
    powerupName: 'Turbo Derrapada',
    powerupDesc: 'Avanza 5 casillas y roba una tirada extra',
    applyPowerup(actor, state) {
      actor.position = Math.min(actor.position + 5, TOTAL_CELLS - 1);
      actor.extraRoll = (actor.extraRoll || 0) + 1;
      const msg = `${actor.name} usa Turbo Derrapada! +5 casillas y tirada extra!`;
      addLog(msg, 'powerup');
      return msg;
    },
  },
  {
    id: 'ecoli',
    name: 'E. coli',
    emoji: '🦠',
    color: '#80ED99',
    image: 'assets/characters/ecoli.png',
    powerupName: 'División Rápida',
    powerupDesc: 'Duplica tu tirada y crea un obstáculo en la casilla actual',
    applyPowerup(actor, state) {
      // Duplica el último resultado del dado
      const bonus = (state.lastDiceRoll || 3) * 2;
      actor.position = Math.min(actor.position + bonus, TOTAL_CELLS - 1);
      // Crea obstáculo en la casilla donde estaba antes
      const obstacleCell = Math.max(0, actor.position - bonus);
      state.obstacles.push({ cell: obstacleCell, placedBy: actor.id, turns: 3 });
      const msg = `${actor.name} divide y conquista! Avanza ${bonus} casillas. Obstáculo en casilla ${obstacleCell}!`;
      addLog(msg, 'powerup');
      return msg;
    },
  },
  {
    id: 'saul_goodman',
    name: 'Saul Goodman',
    emoji: '💼',
    color: '#F4A261',
    image: 'assets/characters/saul_goodman.png',
    powerupName: 'Negociación Experta',
    powerupDesc: 'Cambia la casilla de un jugador contiguo a otra vacía',
    applyPowerup(actor, state) {
      // Busca el jugador más cercano (cualquier dirección)
      let target = null;
      let minDist = Infinity;
      state.players.forEach(p => {
        if (p.id !== actor.id) {
          const d = Math.abs(p.position - actor.position);
          if (d < minDist) { minDist = d; target = p; }
        }
      });
      if (target) {
        const oldPos = target.position;
        // Manda al jugador a una casilla aleatoria detrás suya
        const newPos = Math.max(0, target.position - Math.floor(Math.random() * 5) - 2);
        target.position = newPos;
        const msg = `${actor.name} negocia! ${target.name} va de casilla ${oldPos} a ${newPos}!`;
        addLog(msg, 'powerup');
        return msg;
      }
      // Sin jugadores cercanos: avanza 2
      actor.position = Math.min(actor.position + 2, TOTAL_CELLS - 1);
      const msg = `${actor.name} activa Negociación Experta y avanza 2 casillas!`;
      addLog(msg, 'powerup');
      return msg;
    },
  },
  {
    id: 'kinger',
    name: 'Kinger',
    emoji: '👑',
    color: '#7B2D8B',
    image: 'assets/characters/kinger.png',
    powerupName: 'Glitch Digital',
    powerupDesc: 'Intercambia aleatoriamente la posición de 2 jugadores y avanza 4',
    applyPowerup(actor, state) {
      const others = state.players.filter(p => p.id !== actor.id);
      if (others.length >= 2) {
        // Escoge 2 jugadores al azar
        const shuffled = others.sort(() => Math.random() - 0.5);
        const a = shuffled[0], b = shuffled[1];
        [a.position, b.position] = [b.position, a.position];
        actor.position = Math.min(actor.position + 4, TOTAL_CELLS - 1);
        const msg = `${actor.name} hace GLITCH! Intercambia a ${a.name} y ${b.name}! +4 casillas`;
        addLog(msg, 'powerup');
        return msg;
      }
      actor.position = Math.min(actor.position + 4, TOTAL_CELLS - 1);
      const msg = `${actor.name} activa Glitch Digital! Avanza 4 casillas`;
      addLog(msg, 'powerup');
      return msg;
    },
  },
  {
    id: 'lorraine_warren',
    name: 'Lorraine Warren',
    emoji: '👻',
    color: '#C77DFF',
    image: 'assets/characters/lorraine_warren.png',
    powerupName: 'Campo Protector',
    powerupDesc: 'Invierte cualquier efecto negativo durante 1 turno (tienes escudo)',
    applyPowerup(actor, state) {
      actor.shielded = true;
      const msg = `${actor.name} activa Campo Protector! Efectos negativos invertidos este turno.`;
      addLog(msg, 'powerup');
      return msg;
    },
  },
  {
    id: 'abeja',
    name: 'Abeja',
    emoji: '🐝',
    color: '#FFD166',
    image: 'assets/characters/abeja.png',
    powerupName: 'Picotazo Veloz',
    powerupDesc: 'Un jugador retrocede 2 casillas y tú avanzas 5',
    applyPowerup(actor, state) {
      const others = state.players.filter(p => p.id !== actor.id);
      if (others.length > 0) {
        const victim = others[Math.floor(Math.random() * others.length)];
        victim.position = Math.max(0, victim.position - 2);
        actor.position = Math.min(actor.position + 5, TOTAL_CELLS - 1);
        const msg = `${actor.name} pica a ${victim.name}! (-2 casillas). ${actor.name} avanza 5!`;
        addLog(msg, 'powerup');
        return msg;
      }
      actor.position = Math.min(actor.position + 5, TOTAL_CELLS - 1);
      const msg = `${actor.name} activa Picotazo Veloz! +5 casillas`;
      addLog(msg, 'powerup');
      return msg;
    },
  },
  {
    id: 'agaporni',
    name: 'Agaporni',
    emoji: '🦜',
    color: '#06D6A0',
    image: 'assets/characters/agaporni.png',
    powerupName: 'Beso Travieso',
    powerupDesc: 'Intercambia posición con un jugador y roba su próxima tirada',
    applyPowerup(actor, state) {
      // Busca el jugador más adelantado
      let target = null;
      let maxPos = -1;
      state.players.forEach(p => {
        if (p.id !== actor.id && p.position > maxPos) {
          maxPos = p.position; target = p;
        }
      });
      if (target) {
        [actor.position, target.position] = [target.position, actor.position];
        // "Roba" la tirada: el objetivo pierde su próximo turno
        target.skipTurns = (target.skipTurns || 0) + 1;
        const msg = `${actor.name} besa y enamora a ${target.name}! Intercambian posiciones. ${target.name} pierde turno.`;
        addLog(msg, 'powerup');
        return msg;
      }
      actor.position = Math.min(actor.position + 3, TOTAL_CELLS - 1);
      const msg = `${actor.name} activa Beso Travieso! +3 casillas`;
      addLog(msg, 'powerup');
      return msg;
    },
  },
  {
    id: 'patata_frita',
    name: 'Patata Frita',
    emoji: '🍟',
    color: '#EF233C',
    image: 'assets/characters/patata_frita.png',
    powerupName: 'Explosión Crujiente',
    powerupDesc: 'Crea un obstáculo que retrocede 1-2 casillas a quienes pasen',
    applyPowerup(actor, state) {
      // Crea obstáculo permanente (5 turnos) un poco por delante
      const trapCell = Math.min(actor.position + 4, TOTAL_CELLS - 2);
      state.obstacles.push({ cell: trapCell, placedBy: actor.id, turns: 5 });
      actor.position = Math.min(actor.position + 3, TOTAL_CELLS - 1);
      const msg = `${actor.name} explota crujiente! Trampa en casilla ${trapCell}. Avanza 3.`;
      addLog(msg, 'powerup');
      return msg;
    },
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   3. EVENTOS ALEATORIOS (15 en total)
   Para modificar eventos edita solo este array.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Cada evento tiene:
 *  - id:       identificador único
 *  - name:     nombre mostrado
 *  - emoji:    icono del evento
 *  - desc:     descripción corta para el popup
 *  - apply(players):  función que aplica el efecto
 */
const RANDOM_EVENTS = [
  {
    id: 'viento',
    name: 'Viento del Circuito',
    emoji: '💨',
    desc: 'El viento empuja a todos los jugadores 2 casillas hacia adelante!',
    apply(players) {
      players.forEach(p => { p.position = Math.min(p.position + 2, TOTAL_CELLS - 1); });
      return 'Todos avanzan 2 casillas por el viento!';
    },
  },
  {
    id: 'lluvia',
    name: 'Lluvia Repentina',
    emoji: '🌧️',
    desc: 'Llueve en el circuito! Todos los jugadores retroceden 1 casilla.',
    apply(players) {
      players.forEach(p => { p.position = Math.max(0, p.position - 1); });
      return 'Lluvia! Todos retroceden 1 casilla.';
    },
  },
  {
    id: 'bandera_amarilla',
    name: 'Bandera Amarilla',
    emoji: '🏁',
    desc: 'Dirección saca bandera amarilla. El último jugador pierde su próximo turno.',
    apply(players) {
      const sorted = [...players].sort((a, b) => a.position - b.position);
      const last = sorted[0];
      last.skipTurns = (last.skipTurns || 0) + 1;
      return `Bandera amarilla! ${last.name} pierde su próximo turno.`;
    },
  },
  {
    id: 'invasion_aficionados',
    name: 'Invasión de Aficionados',
    emoji: '📸',
    desc: 'Los fans invaden la pista! Un jugador al azar avanza 2 casillas.',
    apply(players) {
      const lucky = players[Math.floor(Math.random() * players.length)];
      lucky.position = Math.min(lucky.position + 2, TOTAL_CELLS - 1);
      return `Los fans empujan a ${lucky.name}! Avanza 2 casillas.`;
    },
  },
  {
    id: 'intercambio',
    name: 'Caos en los Boxes',
    emoji: '🔄',
    desc: 'Los mecánicos se confunden. Dos jugadores al azar intercambian posición.',
    apply(players) {
      if (players.length < 2) return 'Caos en boxes... sin efecto.';
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      const a = shuffled[0], b = shuffled[1];
      [a.position, b.position] = [b.position, a.position];
      return `Caos en boxes! ${a.name} y ${b.name} intercambian posiciones!`;
    },
  },
  {
    id: 'tirada_extra',
    name: 'Safety Car Retirado',
    emoji: '🚗',
    desc: 'Se retira el Safety Car. El jugador actual recibe una tirada extra!',
    apply(players, state) {
      const current = players[state.currentPlayerIndex];
      current.extraRoll = (current.extraRoll || 0) + 1;
      return `${current.name} recibe una tirada extra gracias al Safety Car!`;
    },
  },
  {
    id: 'teleport',
    name: 'Warp Zone',
    emoji: '🌀',
    desc: 'Portal extraño en la pista! El líder es teleportado al inicio de su mitad.',
    apply(players) {
      const leader = [...players].sort((a, b) => b.position - a.position)[0];
      const half = Math.floor(leader.position / 2);
      leader.position = Math.max(0, half);
      return `Warp Zone! ${leader.name} es teleportado a casilla ${leader.position}!`;
    },
  },
  {
    id: 'turbo_todos',
    name: 'DRS Activado',
    emoji: '⚡',
    desc: 'DRS abierto para todos! Todos los jugadores avanzan 3 casillas.',
    apply(players) {
      players.forEach(p => { p.position = Math.min(p.position + 3, TOTAL_CELLS - 1); });
      return 'DRS activado! Todos avanzan 3 casillas!';
    },
  },
  {
    id: 'retraso',
    name: 'Avería Mecánica',
    emoji: '🔧',
    desc: 'Fallo mecánico general! El jugador con más casillas retrocede 3.',
    apply(players) {
      const leader = [...players].sort((a, b) => b.position - a.position)[0];
      leader.position = Math.max(0, leader.position - 3);
      return `Avería mecánica! ${leader.name} retrocede 3 casillas.`;
    },
  },
  {
    id: 'nube_humo',
    name: 'Nube de Humo',
    emoji: '💥',
    desc: 'Humo en la pista! Todos pierden 1 turno excepto el último.',
    apply(players) {
      const sorted = [...players].sort((a, b) => b.position - a.position);
      sorted.slice(0, -1).forEach(p => { p.skipTurns = (p.skipTurns || 0) + 1; });
      const safe = sorted[sorted.length - 1];
      return `Nube de humo! Solo ${safe.name} se libra. Los demás pierden turno.`;
    },
  },
  {
    id: 'vuelta_rapida',
    name: 'Vuelta Rápida',
    emoji: '🏆',
    desc: 'El más rápido recibe un regalo! El líder avanza 2 casillas extra.',
    apply(players) {
      const leader = [...players].sort((a, b) => b.position - a.position)[0];
      leader.position = Math.min(leader.position + 2, TOTAL_CELLS - 1);
      return `Vuelta rápida! ${leader.name} avanza 2 casillas extra como líder.`;
    },
  },
  {
    id: 'salida_falsa',
    name: 'Salida en Falso',
    emoji: '🚦',
    desc: 'Salida en falso! El jugador que más tiempo lleva jugando pierde el turno.',
    apply(players, state) {
      // El jugador con más turnos jugados (índice anterior) pierde turno
      const current = players[state.currentPlayerIndex];
      current.skipTurns = (current.skipTurns || 0) + 1;
      return `Salida en falso! ${current.name} pierde turno.`;
    },
  },
  {
    id: 'pit_stop',
    name: 'Pit Stop Relámpago',
    emoji: '⛽',
    desc: 'Pit stop express! El jugador de cola recibe 2 casillas de ventaja.',
    apply(players) {
      const last = [...players].sort((a, b) => a.position - b.position)[0];
      last.position = Math.min(last.position + 2, TOTAL_CELLS - 1);
      return `Pit Stop Relámpago! ${last.name} recibe +2 casillas de ventaja.`;
    },
  },
  {
    id: 'trofeo',
    name: 'Trofeo del Circuito',
    emoji: '🥇',
    desc: 'El circuito entrega un trofeo especial. Un jugador al azar avanza 4 casillas!',
    apply(players) {
      const lucky = players[Math.floor(Math.random() * players.length)];
      lucky.position = Math.min(lucky.position + 4, TOTAL_CELLS - 1);
      return `${lucky.name} recibe el Trofeo del Circuito! Avanza 4 casillas.`;
    },
  },
  {
    id: 'chicane',
    name: 'Chicane Sorpresa',
    emoji: '🪨',
    desc: 'Aparece una chicane improvisada. Todos retroceden 2 casillas.',
    apply(players) {
      players.forEach(p => { p.position = Math.max(0, p.position - 2); });
      return 'Chicane sorpresa! Todos retroceden 2 casillas.';
    },
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   4. ESTADO DEL JUEGO
   ────────────────────────────────────────────────────────────────────────── */

/**
 * gameState: estado global de la partida en curso.
 * Se resetea con initGameState().
 */
let gameState = null;

/**
 * setupState: estado de la pantalla de configuración.
 */
let setupState = {
  playerCount: 0,
  currentSetupPlayer: 0,  // índice del jugador que está escogiendo
  players: [],             // jugadores ya configurados
};

/* ──────────────────────────────────────────────────────────────────────────
   5. GENERACIÓN DEL TABLERO
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Genera el array de tipos de celda (50 celdas).
 * La celda 0 siempre es 'start', la 49 es 'finish', la GREEN_CELL es 'green'.
 * El resto se distribuye aleatoriamente según CELL_TYPE_WEIGHTS.
 * @returns {string[]} Array de tipos de celda
 */
function generateCells() {
  const cells = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (i === 0)           { cells.push('start');  continue; }
    if (i === TOTAL_CELLS - 1) { cells.push('finish'); continue; }
    if (i === GREEN_CELL)  { cells.push('green');  continue; }
    const r = Math.random();
    if (r < CELL_TYPE_WEIGHTS.red)
      cells.push('red');
    else if (r < CELL_TYPE_WEIGHTS.red + CELL_TYPE_WEIGHTS.yellow)
      cells.push('yellow');
    else
      cells.push('white');
  }
  return cells;
}

/**
 * Devuelve las coordenadas SVG (cx, cy) del centro de la casilla `index`
 * siguiendo el patrón serpentina (5 filas x 10 columnas).
 * Fila 0: izquierda → derecha
 * Fila 1: derecha → izquierda
 * … etc.
 *
 * @param {number} index - índice de la casilla (0-49)
 * @returns {{x: number, y: number}}
 */
function getCellCoords(index) {
  const row = Math.floor(index / CELLS_PER_ROW);
  const col = index % CELLS_PER_ROW;
  // En filas impares invertimos la columna (serpentina)
  const effectiveCol = (row % 2 === 0) ? col : (CELLS_PER_ROW - 1 - col);

  // Márgenes y espaciado
  const marginX = 50;
  const marginY = 56;
  const spacingX = (SVG_W - marginX * 2) / (CELLS_PER_ROW - 1);
  const spacingY = (SVG_H - marginY * 2) / (NUM_ROWS - 1);

  return {
    x: marginX + effectiveCol * spacingX,
    y: marginY + row * spacingY,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   6. RENDERIZADO DEL TABLERO SVG
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Renderiza el tablero completo en el SVG #board-svg:
 * - camino/pista
 * - casillas
 * - fichas de jugadores
 */
function renderBoard() {
  const svg = document.getElementById('board-svg');
  if (!svg || !gameState) return;
  svg.innerHTML = ''; // limpiar

  const cells = gameState.cells;

  // ── 6a. Dibujar la pista (línea que conecta casillas) ──────────────────
  // Construimos un polyline con todas las coordenadas
  let pathPoints = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const { x, y } = getCellCoords(i);
    pathPoints.push(`${x},${y}`);
  }

  // Sombra del camino (más gruesa, oscura)
  const trackShadow = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  trackShadow.setAttribute('points', pathPoints.join(' '));
  trackShadow.setAttribute('fill', 'none');
  trackShadow.setAttribute('stroke', 'rgba(0,0,0,0.25)');
  trackShadow.setAttribute('stroke-width', '26');
  trackShadow.setAttribute('stroke-linecap', 'round');
  trackShadow.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(trackShadow);

  // Pista principal (asfalto oscuro)
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  track.setAttribute('points', pathPoints.join(' '));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', '#2C2C3E');
  track.setAttribute('stroke-width', '22');
  track.setAttribute('stroke-linecap', 'round');
  track.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(track);

  // Línea central blanca discontinua
  const dashes = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  dashes.setAttribute('points', pathPoints.join(' '));
  dashes.setAttribute('fill', 'none');
  dashes.setAttribute('stroke', 'rgba(255,255,255,0.25)');
  dashes.setAttribute('stroke-width', '2');
  dashes.setAttribute('stroke-dasharray', '8 12');
  dashes.setAttribute('stroke-linecap', 'round');
  svg.appendChild(dashes);

  // ── 6b. Dibujar las casillas ────────────────────────────────────────────
  cells.forEach((type, i) => {
    const { x, y } = getCellCoords(i);
    const color = CELL_COLORS[type] || CELL_COLORS.white;
    const r = 18; // radio del círculo de la casilla

    // Sombra
    const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    shadow.setAttribute('cx', x + 2);
    shadow.setAttribute('cy', y + 3);
    shadow.setAttribute('r', r);
    shadow.setAttribute('fill', 'rgba(0,0,0,0.3)');
    svg.appendChild(shadow);

    // Casilla
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', type === 'green' ? '3.5' : '2');
    if (type === 'green') {
      circle.setAttribute('stroke', '#FFD700');
    }
    svg.appendChild(circle);

    // Ícono/número dentro de la casilla
    let label = '';
    if (type === 'start')  label = '🚦';
    else if (type === 'finish') label = '🏁';
    else if (type === 'green')  label = '⭐';
    else label = String(i);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y + (label.length > 2 ? 5 : 4));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', label.length > 2 ? '14' : '9');
    text.setAttribute('fill', type === 'white' || type === 'yellow' ? '#333' : '#fff');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-family', 'Nunito, sans-serif');
    text.textContent = label;
    svg.appendChild(text);

    // Obstáculo sobre la casilla
    const hasObstacle = gameState.obstacles.some(o => o.cell === i);
    if (hasObstacle) {
      const obs = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      obs.setAttribute('x', x + 14);
      obs.setAttribute('y', y - 14);
      obs.setAttribute('font-size', '14');
      obs.setAttribute('text-anchor', 'middle');
      obs.textContent = '⚠️';
      svg.appendChild(obs);
    }
  });

  // ── 6c. Dibujar fichas de jugadores ────────────────────────────────────
  // Agrupamos jugadores por casilla para offset horizontal
  const byCell = {};
  gameState.players.forEach(p => {
    if (!byCell[p.position]) byCell[p.position] = [];
    byCell[p.position].push(p);
  });

  gameState.players.forEach(p => {
    const { x, y } = getCellCoords(p.position);
    const group = byCell[p.position];
    const idx   = group.indexOf(p);
    const total = group.length;
    const offsetX = total > 1 ? (idx - (total - 1) / 2) * 16 : 0;
    const offsetY = -28;

    // Sombra ficha
    const tokenShadow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    tokenShadow.setAttribute('cx', x + offsetX + 1);
    tokenShadow.setAttribute('cy', y + offsetY + 3);
    tokenShadow.setAttribute('r', 14);
    tokenShadow.setAttribute('fill', 'rgba(0,0,0,0.35)');
    svg.appendChild(tokenShadow);

    // Ficha (círculo del color del personaje)
    const charDef = CHARACTERS.find(c => c.id === p.characterId);
    const tokenColor = charDef ? charDef.color : '#CCCCCC';
    const isActive = gameState.players[gameState.currentPlayerIndex].id === p.id;

    const token = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    token.setAttribute('cx', x + offsetX);
    token.setAttribute('cy', y + offsetY);
    token.setAttribute('r', 14);
    token.setAttribute('fill', tokenColor);
    token.setAttribute('stroke', isActive ? '#FFD700' : '#fff');
    token.setAttribute('stroke-width', isActive ? '3' : '2');
    svg.appendChild(token);

    // Emoji del personaje sobre la ficha
    const tokenEmoji = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tokenEmoji.setAttribute('x', x + offsetX);
    tokenEmoji.setAttribute('y', y + offsetY + 5);
    tokenEmoji.setAttribute('text-anchor', 'middle');
    tokenEmoji.setAttribute('dominant-baseline', 'middle');
    tokenEmoji.setAttribute('font-size', '13');
    tokenEmoji.textContent = charDef ? charDef.emoji : '?';
    svg.appendChild(tokenEmoji);

    // Indicador de ficha activa (estrella parpadeante)
    if (isActive) {
      const star = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      star.setAttribute('x', x + offsetX + 13);
      star.setAttribute('y', y + offsetY - 10);
      star.setAttribute('font-size', '10');
      star.textContent = '✨';
      star.style.animation = 'blink 1s infinite alternate';
      svg.appendChild(star);
    }
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   7. RENDERIZADO DEL PANEL LATERAL
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Actualiza la lista de jugadores en el panel lateral con clasificación.
 */
function renderPlayers() {
  const list = document.getElementById('players-list');
  if (!list || !gameState) return;

  // Ordenar por posición (de mayor a menor = más cerca de la meta)
  const sorted = [...gameState.players].sort((a, b) => b.position - a.position);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  list.innerHTML = sorted.map((p, rank) => {
    const charDef = CHARACTERS.find(c => c.id === p.characterId);
    const isActive = p.id === currentPlayer.id;
    const progress = Math.round((p.position / (TOTAL_CELLS - 1)) * 100);
    const emoji = charDef ? charDef.emoji : '?';
    const color = charDef ? charDef.color : '#ccc';
    const badges = [];
    if (p.skipTurns > 0)  badges.push(`<span class="badge badge-skip">💤×${p.skipTurns}</span>`);
    if (p.extraRoll > 0)  badges.push(`<span class="badge badge-extra">🎲+${p.extraRoll}</span>`);
    if (p.shielded)       badges.push(`<span class="badge badge-shield">🛡️</span>`);

    return `
      <div class="player-item${isActive ? ' active-player' : ''}" style="border-left-color:${color}">
        <div class="player-rank">${rank + 1}°</div>
        <div class="player-emoji">${emoji}</div>
        <div class="player-info">
          <div class="player-name">${p.name} <span class="player-char-name">(${charDef ? charDef.name : '?'})</span></div>
          <div class="player-badges">${badges.join('')}</div>
          <div class="player-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width:${progress}%;background:${color}"></div>
            </div>
            <span class="progress-label">Casilla ${p.position}/${TOTAL_CELLS - 1}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/**
 * Actualiza el indicador de turno en la cabecera.
 */
function renderTurnIndicator() {
  const el = document.getElementById('turn-indicator');
  if (!el || !gameState) return;
  const p = gameState.players[gameState.currentPlayerIndex];
  const charDef = CHARACTERS.find(c => c.id === p.characterId);
  el.innerHTML = `
    <span>Turno de</span>
    <strong style="color:${charDef ? charDef.color : '#fff'}">${charDef ? charDef.emoji : ''} ${p.name}</strong>
  `;
}

/* ──────────────────────────────────────────────────────────────────────────
   8. LOG DE EVENTOS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Añade una entrada al registro de eventos.
 * @param {string} msg   - mensaje a mostrar
 * @param {string} type  - tipo: 'roll'|'red'|'yellow'|'green'|'powerup'|'event'|
 *                                'turn'|'warning'|'win'|'start'|'obstacle'|'shield'|'bonus'
 */
function addLog(msg, type = 'turn') {
  const log = document.getElementById('event-log-content');
  if (!log) return;

  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;

  const icons = {
    roll: '🎲', red: '🔴', yellow: '🟡', green: '💚', powerup: '✨',
    event: '⚡', turn: '▶️', warning: '⚠️', win: '🏆',
    start: '🚀', obstacle: '🚧', shield: '🛡️', bonus: '🎁',
  };
  const icon = icons[type] || '📋';

  entry.innerHTML = `<span class="log-icon">${icon}</span><span class="log-text">${msg}</span>`;
  log.prepend(entry);

  // Limitar a 40 entradas
  while (log.children.length > 40) {
    log.removeChild(log.lastChild);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   9. POPUPS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Muestra el popup de efecto de casilla (desaparece solo).
 * @param {string} text  - mensaje
 * @param {string} color - color de fondo (hex)
 */
function showCellPopup(text, color) {
  const popup = document.getElementById('cell-popup');
  const textEl = document.getElementById('cell-popup-text');
  if (!popup || !textEl) return;
  textEl.textContent = text;
  popup.style.display = 'flex';
  popup.querySelector('.popup-inner').style.background = color;
  clearTimeout(showCellPopup._timer);
  showCellPopup._timer = setTimeout(() => {
    popup.style.display = 'none';
  }, 2000);
}

/**
 * Muestra el popup de evento aleatorio (se cierra con clic o automáticamente).
 * @param {string} title - título del evento
 * @param {string} desc  - descripción del evento
 */
function showEventPopup(title, desc) {
  const popup   = document.getElementById('event-popup');
  const titleEl = document.getElementById('event-popup-title');
  const descEl  = document.getElementById('event-popup-desc');
  if (!popup || !titleEl || !descEl) return;
  titleEl.textContent = title;
  descEl.textContent = desc;
  popup.style.display = 'flex';
  clearTimeout(showEventPopup._timer);
  showEventPopup._timer = setTimeout(() => {
    popup.style.display = 'none';
  }, 3500);
  popup.onclick = () => { popup.style.display = 'none'; };
}

/**
 * Muestra la pantalla de victoria.
 * @param {object} player - jugador ganador
 */
function showWinScreen(player) {
  const screen = document.getElementById('win-screen');
  if (!screen) return;
  const charDef = CHARACTERS.find(c => c.id === player.characterId);
  screen.style.display = 'flex';
  screen.innerHTML = `
    <div class="win-inner">
      <div class="win-emoji">${charDef ? charDef.emoji : '🏆'}</div>
      <h1 class="win-title">¡${player.name} GANA!</h1>
      <p class="win-subtitle">con ${charDef ? charDef.name : player.characterId}</p>
      <p class="win-char-power">Power-up: <strong>${charDef ? charDef.powerupName : ''}</strong></p>
      <div class="win-confetti">🎉🏁🎊🏎️🎉🏆🎊🏁🎉</div>
      <button class="win-restart-btn" onclick="restartGame()">🔄 Jugar de Nuevo</button>
    </div>`;
  addLog(`🏆 ${player.name} (${charDef ? charDef.name : ''}) ha llegado a la meta!`, 'win');
}

/* ──────────────────────────────────────────────────────────────────────────
   10. LÓGICA DE TURNO Y DADO
   ────────────────────────────────────────────────────────────────────────── */

/** Emojis de caras de dado */
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

/**
 * Maneja el click en el botón "Tirar Dado".
 * Punto de entrada principal del turno.
 */
function handleRollDice() {
  if (!gameState || gameState.phase !== 'playing') return;

  const btn = document.getElementById('roll-btn');
  if (btn) btn.disabled = true;

  // Animación del dado
  animateDice(() => {
    const roll = Math.floor(Math.random() * 6) + 1;
    gameState.lastDiceRoll = roll;
    const diceEl = document.getElementById('dice-display');
    if (diceEl) diceEl.textContent = DICE_FACES[roll - 1];

    const player = gameState.players[gameState.currentPlayerIndex];
    addLog(`${player.name} saca un ${roll}`, 'roll');
    executeMove(player, roll);
  });
}

/**
 * Anima el dado girando caras aleatorias.
 * @param {Function} cb - callback al terminar la animación
 */
function animateDice(cb) {
  const diceEl = document.getElementById('dice-display');
  if (!diceEl) { cb(); return; }
  diceEl.classList.add('rolling');
  let frames = 0;
  const maxFrames = 12;
  const interval = setInterval(() => {
    diceEl.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
    frames++;
    if (frames >= maxFrames) {
      clearInterval(interval);
      diceEl.classList.remove('rolling');
      cb();
    }
  }, 80);
}

/**
 * Ejecuta el movimiento del jugador tras tirar el dado.
 * @param {object} player - jugador que mueve
 * @param {number} roll   - resultado del dado
 */
function executeMove(player, roll) {
  const oldPos = player.position;
  const newPos = Math.min(oldPos + roll, TOTAL_CELLS - 1);
  player.position = newPos;

  // Incrementar contador global de casillas recorridas
  gameState.totalCellsMoved = (gameState.totalCellsMoved || 0) + roll;

  // Actualizar UI
  renderBoard();
  renderPlayers();

  // Pequeño retraso para que se vea el movimiento antes del efecto
  setTimeout(() => {
    // Comprobar obstáculo en la nueva casilla
    const obstacleIdx = gameState.obstacles.findIndex(o => o.cell === newPos);
    if (obstacleIdx !== -1 && !player.immuneNextCell) {
      const knockback = Math.floor(Math.random() * 2) + 1;
      player.position = Math.max(0, player.position - knockback);
      gameState.obstacles[obstacleIdx].turns--;
      if (gameState.obstacles[obstacleIdx].turns <= 0) {
        gameState.obstacles.splice(obstacleIdx, 1);
      }
      addLog(`${player.name} choca con un obstáculo y retrocede ${knockback} casillas!`, 'obstacle');
      showCellPopup(`💥 Obstáculo! -${knockback} casillas`, '#FF6B35');
      renderBoard();
      renderPlayers();
    }

    // Limpiar inmunidad
    player.immuneNextCell = false;

    // Comprobar si ganó
    if (player.position >= TOTAL_CELLS - 1) {
      gameState.phase = 'won';
      renderBoard();
      showWinScreen(player);
      return;
    }

    // Efecto de casilla (si no tiene escudo para convertirlo)
    applyCellEffect(player, player.position);

    // Comprobar evento aleatorio
    if (gameState.totalCellsMoved > 0 &&
        Math.floor(gameState.totalCellsMoved / EVENT_INTERVAL) > gameState.lastEventAt) {
      gameState.lastEventAt = Math.floor(gameState.totalCellsMoved / EVENT_INTERVAL);
      setTimeout(() => triggerRandomEvent(), 1000);
    }

    // Pasar turno después de un breve delay
    setTimeout(() => nextTurn(), 600);

  }, 400);
}

/**
 * Aplica el efecto de la casilla donde aterrizó el jugador.
 * @param {object} player   - jugador que aterrizó
 * @param {number} cellIndex - índice de la casilla
 */
function applyCellEffect(player, cellIndex) {
  const type = gameState.cells[cellIndex];
  const isShielded = player.shielded;

  // Si tiene escudo, los efectos negativos se convierten en positivos
  if (isShielded) {
    player.shielded = false;
    addLog(`${player.name} usó el escudo de Lorraine Warren!`, 'shield');
  }

  switch (type) {
    case 'red': {
      const effect = isShielded ? 'positive_override' :
                     (Math.random() < 0.5 ? 'back1' : 'skip');
      if (effect === 'back1') {
        player.position = Math.max(0, player.position - 1);
        addLog(`${player.name} cae en casilla roja! Retrocede 1 casilla`, 'red');
        showCellPopup('🔴 Retrocedes 1 casilla!', CELL_COLORS.red);
      } else if (effect === 'skip') {
        player.skipTurns = (player.skipTurns || 0) + 1;
        addLog(`${player.name} cae en casilla roja! Pierde el próximo turno`, 'red');
        showCellPopup('🔴 Pierdes el próximo turno!', CELL_COLORS.red);
      } else {
        // Con escudo: convierte en avance
        player.position = Math.min(player.position + 1, TOTAL_CELLS - 1);
        addLog(`${player.name} convierte la casilla roja en avance gracias al escudo!`, 'shield');
        showCellPopup('🛡️ Escudo activo! +1 casilla', '#9B59B6');
      }
      break;
    }
    case 'yellow': {
      const effect = Math.random() < 0.5 ? 'fwd' : 'reroll';
      if (effect === 'fwd') {
        const bonus = Math.floor(Math.random() * 2) + 1;
        player.position = Math.min(player.position + bonus, TOTAL_CELLS - 1);
        addLog(`${player.name} cae en casilla amarilla! Avanza ${bonus} casillas más`, 'yellow');
        showCellPopup(`🟡 Avanzas ${bonus} casilla${bonus > 1 ? 's' : ''}!`, CELL_COLORS.yellow);
      } else {
        player.extraRoll = (player.extraRoll || 0) + 1;
        addLog(`${player.name} cae en casilla amarilla! Tirada extra!`, 'yellow');
        showCellPopup('🟡 ¡Tirada extra!', CELL_COLORS.yellow);
      }
      break;
    }
    case 'green': {
      addLog(`${player.name} cae en la casilla especial verde! Activando power-up...`, 'green');
      showCellPopup('⭐ ¡CASILLA VERDE! Power-up activado!', CELL_COLORS.green);
      setTimeout(() => {
        const charDef = CHARACTERS.find(c => c.id === player.characterId);
        if (charDef) {
          const msg = charDef.applyPowerup(player, gameState);
          showEventPopup(`✨ ${charDef.powerupName}`, msg || charDef.powerupDesc);
          renderBoard();
          renderPlayers();
        }
      }, 600);
      break;
    }
    case 'start':
    case 'finish':
    case 'white':
    default:
      // Sin efecto
      break;
  }

  renderBoard();
  renderPlayers();
}

/**
 * Activa un evento aleatorio de la lista RANDOM_EVENTS.
 */
function triggerRandomEvent() {
  if (!gameState || gameState.phase !== 'playing') return;
  const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
  const result = event.apply(gameState.players, gameState);
  showEventPopup(`${event.emoji} ${event.name}`, result || event.desc);
  addLog(`EVENTO: ${event.name} — ${result}`, 'event');
  renderBoard();
  renderPlayers();
}

/**
 * Avanza al siguiente jugador:
 * - Si el jugador actual tiene turno extra, repite
 * - Si el siguiente jugador tiene turno bloqueado, lo salta
 */
function nextTurn() {
  if (!gameState || gameState.phase !== 'playing') return;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  // ¿Tiene tiradas extra?
  if (currentPlayer.extraRoll > 0) {
    currentPlayer.extraRoll--;
    addLog(`${currentPlayer.name} usa su tirada extra!`, 'bonus');
    enableRollButton();
    renderTurnIndicator();
    renderPlayers();
    return;
  }

  // Buscar el siguiente jugador que no tenga turno bloqueado
  let next = (gameState.currentPlayerIndex + 1) % gameState.players.length;
  let loops = 0;
  while (gameState.players[next].skipTurns > 0 && loops < gameState.players.length) {
    gameState.players[next].skipTurns--;
    addLog(`${gameState.players[next].name} pierde su turno`, 'warning');
    next = (next + 1) % gameState.players.length;
    loops++;
  }

  gameState.currentPlayerIndex = next;
  gameState.turnCount++;

  renderTurnIndicator();
  renderPlayers();
  enableRollButton();
}

/**
 * Reactiva el botón de tirar dado.
 */
function enableRollButton() {
  const btn = document.getElementById('roll-btn');
  if (btn) btn.disabled = false;
}

/* ──────────────────────────────────────────────────────────────────────────
   11. INICIALIZACIÓN DEL JUEGO
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Crea el estado inicial del juego a partir de los jugadores configurados.
 * @param {object[]} players - array de jugadores ya configurados
 */
function initGameState(players) {
  gameState = {
    players,                         // array de jugadores
    cells: generateCells(),          // tipos de casilla
    currentPlayerIndex: 0,           // índice del jugador activo
    turnCount: 1,                    // número de turno
    phase: 'playing',                // 'playing' | 'won'
    obstacles: [],                   // {cell, placedBy, turns}
    lastDiceRoll: 1,                 // último resultado del dado
    totalCellsMoved: 0,              // acumulado para eventos aleatorios
    lastEventAt: 0,                  // última unidad de intervalo de evento
  };
}

/**
 * Arranca la partida con los jugadores configurados.
 * @param {object[]} players
 */
function startGame(players) {
  initGameState(players);

  // Mostrar pantalla de juego
  document.getElementById('setup-screen').style.display = 'none';
  const gameScreen = document.getElementById('game-screen');
  gameScreen.style.display = 'flex';

  addLog('¡Que empiece la carrera! 🏎️', 'start');
  players.forEach(p => {
    const charDef = CHARACTERS.find(c => c.id === p.characterId);
    addLog(`${p.name} elige a ${charDef ? charDef.name : p.characterId} ${charDef ? charDef.emoji : ''}`, 'start');
  });

  renderBoard();
  renderPlayers();
  renderTurnIndicator();
  enableRollButton();
}

/**
 * Reinicia completamente el juego volviendo a la pantalla de configuración.
 * Llamado por botones de reinicio (global, accesible desde HTML).
 */
function restartGame() {
  gameState = null;
  setupState = { playerCount: 0, currentSetupPlayer: 0, players: [] };

  document.getElementById('game-screen').style.display = 'none';
  const winScreen = document.getElementById('win-screen');
  if (winScreen) winScreen.style.display = 'none';

  document.getElementById('setup-screen').style.display = 'flex';
  showSetupStep1();
}

/* ──────────────────────────────────────────────────────────────────────────
   12. FLUJO DE CONFIGURACIÓN (SETUP)
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Paso 1: Selector de número de jugadores (2-10).
 */
function showSetupStep1() {
  const content = document.getElementById('setup-content');
  if (!content) return;

  content.innerHTML = `
    <div class="setup-step" id="setup-step1">
      <h2 class="setup-step-title">¿Cuántos jugadores?</h2>
      <div class="player-count-grid">
        ${[2,3,4,5,6,7,8,9,10].map(n => `
          <button class="count-btn" onclick="selectPlayerCount(${n})">${n}</button>
        `).join('')}
      </div>
    </div>`;
}

/**
 * Callback del selector de número de jugadores.
 * @param {number} count - número elegido
 */
function selectPlayerCount(count) {
  setupState.playerCount = count;
  setupState.currentSetupPlayer = 0;
  setupState.players = [];
  showSetupPlayerConfig(0);
}

/**
 * Paso 2 (repetido): Configura el jugador `index` (nombre + personaje).
 * @param {number} index - índice del jugador a configurar
 */
function showSetupPlayerConfig(index) {
  const content = document.getElementById('setup-content');
  if (!content) return;

  const takenIds = setupState.players.map(p => p.characterId);
  const total    = setupState.playerCount;

  content.innerHTML = `
    <div class="setup-step" id="setup-step2">
      <h2 class="setup-step-title">Jugador ${index + 1} de ${total}</h2>
      <div class="name-input-wrapper">
        <input
          id="player-name-input"
          type="text"
          class="player-name-input"
          placeholder="Nombre del jugador…"
          maxlength="18"
          autofocus
          value="Jugador ${index + 1}"
        />
      </div>
      <h3 class="setup-char-title">Elige tu personaje</h3>
      <div class="character-grid">
        ${CHARACTERS.map(char => {
          const taken = takenIds.includes(char.id);
          return `
            <div
              class="char-card${taken ? ' taken' : ''}"
              onclick="${taken ? '' : `selectCharacter('${char.id}')`}"
              title="${taken ? 'Ya está cogido' : char.powerupName + ': ' + char.powerupDesc}"
              style="border-color:${char.color};${taken ? 'opacity:0.4;cursor:not-allowed;' : ''}"
            >
              <div class="char-emoji">${char.emoji}</div>
              <div class="char-name">${char.name}</div>
              <div class="char-power">⚡ ${char.powerupName}</div>
              ${taken ? '<div class="char-taken-label">Cogido</div>' : ''}
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

/**
 * Callback al seleccionar un personaje.
 * Guarda el jugador y avanza o inicia el juego.
 * @param {string} characterId
 */
function selectCharacter(characterId) {
  const nameInput = document.getElementById('player-name-input');
  const name = (nameInput ? nameInput.value.trim() : '') || `Jugador ${setupState.currentSetupPlayer + 1}`;

  // Crear objeto jugador
  const player = {
    id: `player_${setupState.currentSetupPlayer}`,
    name,
    characterId,
    position: 0,
    skipTurns: 0,
    extraRoll: 0,
    shielded: false,
    immuneNextCell: false,
  };

  setupState.players.push(player);
  setupState.currentSetupPlayer++;

  if (setupState.currentSetupPlayer < setupState.playerCount) {
    showSetupPlayerConfig(setupState.currentSetupPlayer);
  } else {
    // Todos los jugadores configurados → arrancar partida
    startGame(setupState.players);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   13. ARRANQUE AUTOMÁTICO
   ────────────────────────────────────────────────────────────────────────── */

/** Inicia la pantalla de configuración en cuanto el DOM esté listo */
document.addEventListener('DOMContentLoaded', () => {
  showSetupStep1();
});
