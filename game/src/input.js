// Keyboard and pointer input for Nusa Airlift. Held keys steer and set the throttle;
// one-shot presses (confirm, pause, restart, mute) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or counted twice.
// Mouse drag steers as an alternative to the keys: drag left/right to bank, drag
// up/down to pitch. Clicks land on menu buttons (the loop asks clickPosition()).

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_MISSION_1 = 16;
export const ACTION_MISSION_2 = 32;
export const ACTION_MISSION_3 = 64;

const ROLL_LEFT = new Set(['ArrowLeft', 'KeyA']);
const ROLL_RIGHT = new Set(['ArrowRight', 'KeyD']);
const PITCH_UP = new Set(['ArrowUp']);
const PITCH_DOWN = new Set(['ArrowDown']);
const THROTTLE_UP = new Set(['KeyW', 'ShiftLeft', 'ShiftRight']);
const THROTTLE_DOWN = new Set(['KeyS', 'ControlLeft', 'ControlRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);
// Space doubles as the flaps key while flying: main.js reads the key directly
// for that, and the confirm action it also raises is ignored on the play screen.

export function createInput(target) {
  let rollLeft = false;
  let rollRight = false;
  let pitchUp = false;
  let pitchDown = false;
  let throttleUp = false;
  let throttleDown = false;
  let actions = 0;
  let dragX = 0;
  let dragY = 0;
  let dragging = false;
  let lastClick = null;
  let lastDragStart = null;

  window.addEventListener('keydown', (event) => {
    if (ROLL_LEFT.has(event.code)) rollLeft = true;
    else if (ROLL_RIGHT.has(event.code)) rollRight = true;
    else if (PITCH_UP.has(event.code)) pitchUp = true;
    else if (PITCH_DOWN.has(event.code)) pitchDown = true;
    else if (THROTTLE_UP.has(event.code)) throttleUp = true;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'Digit1' && !event.repeat) actions |= ACTION_MISSION_1;
    else if (event.code === 'Digit2' && !event.repeat) actions |= ACTION_MISSION_2;
    else if (event.code === 'Digit3' && !event.repeat) actions |= ACTION_MISSION_3;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (ROLL_LEFT.has(event.code)) rollLeft = false;
    else if (ROLL_RIGHT.has(event.code)) rollRight = false;
    else if (PITCH_UP.has(event.code)) pitchUp = false;
    else if (PITCH_DOWN.has(event.code)) pitchDown = false;
    else if (THROTTLE_UP.has(event.code)) throttleUp = false;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    rollLeft = false;
    rollRight = false;
    pitchUp = false;
    pitchDown = false;
    throttleUp = false;
    throttleDown = false;
    dragging = false;
    dragX = 0;
    dragY = 0;
  });

  function logicalPoint(event) {
    const rect = target.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
    };
  }

  target.addEventListener('pointerdown', (event) => {
    const point = logicalPoint(event);
    lastClick = point;
    lastDragStart = point;
    dragging = true;
    dragX = 0;
    dragY = 0;
  });
  target.addEventListener('pointermove', (event) => {
    if (!dragging || !lastDragStart) return;
    const point = logicalPoint(event);
    dragX = (point.x - lastDragStart.x) / 220;
    dragY = (point.y - lastDragStart.y) / 160;
    dragX = Math.max(-1, Math.min(1, dragX));
    dragY = Math.max(-1, Math.min(1, dragY));
  });
  function endDrag() {
    dragging = false;
    dragX = 0;
    dragY = 0;
    lastDragStart = null;
  }
  target.addEventListener('pointerup', endDrag);
  target.addEventListener('pointercancel', endDrag);

  return {
    /** -1 left, 1 right, 0 neither/both — keys first, mouse drag second. */
    roll() {
      if (rollRight) return 1;
      if (rollLeft) return -1;
      return dragX;
    },
    /** -1 nose down, 1 nose up — keys first, mouse drag second (drag up = climb). */
    pitch() {
      if (pitchUp) return 1;
      if (pitchDown) return -1;
      return -dragY;
    },
    /** -1 throttle down, 1 throttle up, 0 hold. */
    throttle() {
      if (throttleUp) return 1;
      if (throttleDown) return -1;
      return 0;
    },
    dragging() {
      return dragging;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The latest click in logical 1280x720 coordinates, or null. */
    takeClick() {
      const click = lastClick;
      lastClick = null;
      return click;
    },
  };
}
