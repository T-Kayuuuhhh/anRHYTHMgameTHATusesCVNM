// Game Variables
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const highscoreEl = document.getElementById('highscore');
const judgementEl = document.getElementById('judgement');
const audioPlayer = document.getElementById('audio-player');
const startBtn = document.getElementById('start-btn');
const uploadInput = document.getElementById('audio-upload');

let isPlaying = false;
let score = 0;
let combo = 0;
let notes = [];
let noteSpeed = 7; 
let lastSpawnTime = 0;

// Load High Score from Local Storage (Cookie equivalent)
let highScore = localStorage.getItem('cvnmHighScore') || 0;
highscoreEl.innerText = highScore;

// Keys: C, V, N, M mapped to lanes 0, 1, 2, 3
const keyMap = { 'c': 0, 'v': 1, 'n': 2, 'm': 3 };
const activeKeys = { 0: false, 1: false, 2: false, 3: false };

const hitLineY = 500;
const hitWindowPerfect = 25; 
const hitWindowGood = 50; 

// Web Audio API Variables
let audioContext, analyser, dataArray, source;

// Handle File Upload
uploadInput.addEventListener('change', function(e) {
    const file = this.files[0];
    if (file) {
        const objectURL = URL.createObjectURL(file);
        audioPlayer.src = objectURL;
        startBtn.disabled = false;
    }
});

// Start Game & Audio Analyzer
startBtn.addEventListener('click', () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source = audioContext.createMediaElementSource(audioPlayer);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    // Reset Game State
    score = 0;
    combo = 0;
    notes = [];
    updateScore();
    judgementEl.innerText = "";
    
    audioPlayer.play();
    isPlaying = true;
    requestAnimationFrame(gameLoop);
});

audioPlayer.addEventListener('ended', () => {
    isPlaying = false;
    judgementEl.innerText = "TRACK FINISHED!";
    judgementEl.style.color = "#fff";
});

// Input Handling
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keyMap[key] !== undefined && !activeKeys[keyMap[key]]) {
        activeKeys[keyMap[key]] = true;
        handleHit(keyMap[key]);
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keyMap[key] !== undefined) {
        activeKeys[keyMap[key]] = false;
    }
});

function handleHit(lane) {
    const laneNotes = notes.filter(n => n.lane === lane);
    if (laneNotes.length === 0) return;

    const targetNote = laneNotes[0];
    const distance = Math.abs(targetNote.y - hitLineY);

    if (distance <= hitWindowPerfect) {
        score += 300;
        combo++;
        showJudgement("PERFECT", "#ff007f");
        removeNote(targetNote);
    } else if (distance <= hitWindowGood) {
        score += 100;
        combo++;
        showJudgement("GOOD", "#ff66b2");
        removeNote(targetNote);
    } else if (targetNote.y > hitLineY - hitWindowGood) {
        combo = 0;
        showJudgement("MISS", "#ff3333");
        removeNote(targetNote);
    }
    updateScore();
}

function removeNote(noteToRemove) {
    notes = notes.filter(note => note !== noteToRemove);
}

function showJudgement(text, color) {
    judgementEl.innerText = text;
    judgementEl.style.color = color;
}

function updateScore() {
    scoreEl.innerText = score;
    comboEl.innerText = combo;

    // Save High Score to Local Storage
    if (score > highScore) {
        highScore = score;
        highscoreEl.innerText = highScore;
        localStorage.setItem('cvnmHighScore', highScore);
    }
}

// Auto-Generate Map using Audio Peaks
function spawnNotes(timestamp) {
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average volume of lower frequencies (bass/beats)
    let bassSum = 0;
    for (let i = 0; i < 10; i++) {
        bassSum += dataArray[i];
    }
    let bassAvg = bassSum / 10;

    // If bass spikes above 200 (out of 255) and 250ms has passed, spawn a note!
    if (bassAvg > 200 && timestamp - lastSpawnTime > 250) {
        const randomLane = Math.floor(Math.random() * 4);
        notes.push({ lane: randomLane, y: -20 });
        lastSpawnTime = timestamp;
    }
}

// Main Game Loop
function gameLoop(timestamp) {
    if (!isPlaying) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Hit Line
    ctx.fillStyle = "#333";
    ctx.fillRect(0, hitLineY - 2, canvas.width, 24);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, hitLineY);
    ctx.lineTo(canvas.width, hitLineY);
    ctx.stroke();

    // Draw Lanes & Key Presses
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = "#222";
        ctx.beginPath();
        ctx.moveTo(i * 100, 0);
        ctx.lineTo(i * 100, canvas.height);
        ctx.stroke();

        if (activeKeys[i]) {
            ctx.fillStyle = "rgba(255, 0, 127, 0.2)";
            ctx.fillRect(i * 100, 0, 100, canvas.height);
            ctx.fillStyle = "rgba(255, 0, 127, 0.8)";
            ctx.fillRect(i * 100, hitLineY, 100, 20);
        }
    }

    // Move and Draw Notes
    for (let i = notes.length - 1; i >= 0; i--) {
        let note = notes[i];
        note.y += noteSpeed;

        ctx.fillStyle = "#ff007f";
        ctx.fillRect(note.lane * 100 + 10, note.y, 80, 20);
        
        ctx.fillStyle = "#fff";
        ctx.fillRect(note.lane * 100 + 10, note.y + 15, 80, 5);

        // Check Miss
        if (note.y > canvas.height) {
            combo = 0;
            showJudgement("MISS", "#ff3333");
            updateScore();
            notes.splice(i, 1);
        }
    }

    spawnNotes(timestamp);
    requestAnimationFrame(gameLoop);
}function spawnNote(note) {
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
