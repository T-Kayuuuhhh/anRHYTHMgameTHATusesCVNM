const game = document.getElementById('game');
const lanes = document.querySelectorAll('.lane');
const track = document.getElementById('track');
const loadBtn = document.getElementById('loadBtn');
const playBtn = document.getElementById('playBtn');
const scoreEl = document.getElementById('score');
const judgeEl = document.getElementById('judgement');
const fileInput = document.getElementById('audioFile');
const layout = document.getElementById('layout');

let notes = [];
let score = 0;
let gameRunning = false;
let audioCtx;
let startTime;
let songDuration;

const keyToLane = { 'c': 0, 'v': 1, 'n': 2, 'm': 3 };

// Simple energy-based beat detection
async function findBeats(buffer) {
  const offline = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  const filter = offline.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 150;
  src.connect(filter).connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  const data = rendered.getChannelData(0);

  const beats = [];
  let lastBeat = -1;
  const threshold = 0.08;
  const minGap = 0.25; // seconds

  for (let i = 0; i < data.length; i += 512) {
    let energy = 0;
    for (let j = 0; j < 512; j++) {
      if (i+j < data.length) energy += data[i+j]**2;
    }
    energy = Math.sqrt(energy / 512);

    const time = i / buffer.sampleRate;
    if (energy > threshold && time - lastBeat > minGap) {
      beats.push(time);
      lastBeat = time;
    }
  }
  return beats;
}

async function loadAndMap() {
  if (!fileInput.files[0]) return alert("Pick an audio file first!");
  
  const file = fileInput.files[0];
  const url = URL.createObjectURL(file);
  track.src = url;

  track.onloadedmetadata = () => {
    songDuration = track.duration;
    playBtn.disabled = false;
  };

  // Decode for beat detection
  const arrayBuf = await file.arrayBuffer();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
  const beatTimes = await findBeats(audioBuf);

  notes = beatTimes.map(t => ({
    time: t,
    lane: Math.floor(Math.random() * 4),
    hit: false,
    element: null
  }));

  alert(`Map ready! ${notes.length} notes detected. Hit Play!`);
}

function spawnNote(note) {
  const el = document.createElement('div');
  el.classList.add('note');
  lanes[note.lane].appendChild(el);
  note.element = el;
}

function update() {
  if (!gameRunning) return;

  const now = track.currentTime;

  notes.forEach(note => {
    if (note.element) {
      const progress = (now - (note.time - 2)) / 2; // fall over 2s
      if (progress >= 1) {
        if (!note.hit) {
          note.element.classList.add('miss');
          judgeEl.textContent = 'MISS';
          setTimeout(() => judgeEl.textContent = '', 800);
        }
        setTimeout(() => note.element?.remove(), 400);
        note.element = null;
      } else {
        note.element.style.transform = `translateY(${progress * 100}%)`;
      }
    } else if (now >= note.time - 2 && now < note.time + 0.5) {
      spawnNote(note);
    }
  });

  if (now >= songDuration + 1) {
    gameRunning = false;
    layout.style.display = 'none';
    alert(`Song over! Score: ${score}`);
  } else {
    requestAnimationFrame(update);
  }
}

function start() {
  if (gameRunning) return;
  gameRunning = true;
  layout.style.display = 'block';
  score = 0;
  scoreEl.textContent = 'Score: 0';
  judgeEl.textContent = '';
  track.currentTime = 0;
  track.play().catch(e => console.log("Play failed:", e));
  startTime = performance.now();
  requestAnimationFrame(update);
}

document.addEventListener('keydown', e => {
  if (!gameRunning) return;
  const k = e.key.toLowerCase();
  if (!(k in keyToLane)) return;

  const laneIdx = keyToLane[k];
  const now = track.currentTime;

  // Find closest unhit note in this lane
  let best = null;
  let bestDiff = Infinity;

  notes.forEach(note => {
    if (note.lane === laneIdx && !note.hit && note.element) {
      const diff = Math.abs(note.time - now);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = note;
      }
    }
  });

  if (best && bestDiff < 0.18) { // timing window
    best.hit = true;
    best.element.classList.add('hit');
    score += Math.round(100 * (1 - bestDiff / 0.18));
    scoreEl.textContent = `Score: ${score}`;

    let judge = bestDiff < 0.05 ? 'PERFECT' : bestDiff < 0.10 ? 'GREAT' : 'GOOD';
    judgeEl.textContent = judge;
    judgeEl.style.color = judge === 'PERFECT' ? '#0f0' : judge === 'GREAT' ? '#ff0' : '#0ff';
    setTimeout(() => judgeEl.textContent = '', 900);

    setTimeout(() => best.element?.remove(), 150);
    best.element = null;
  }
});

loadBtn.onclick = loadAndMap;
playBtn.onclick = start;
