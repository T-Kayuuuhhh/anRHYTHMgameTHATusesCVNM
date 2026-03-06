// --- Configuration & State ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const audioPlayer = document.getElementById('audio-player');
const startBtn = document.getElementById('start-btn');
const uploadInput = document.getElementById('audio-upload');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const highscoreEl = document.getElementById('highscore');
const judgementEl = document.getElementById('judgement');

let isPlaying = false;
let score = 0;
let combo = 0;
let totalHits = 0;
let notes = [];
let noteSpeed = 8; 
let lastSpawnTime = 0;
const baseSpawnInterval = 250;
let currentSpawnInterval = baseSpawnInterval;

let highScore = localStorage.getItem('cvnmHighScore') || 0;
highscoreEl.innerText = highScore;

const keyMap = { 'c': 0, 'v': 1, 'n': 2, 'm': 3 };
const activeKeys = { 0: false, 1: false, 2: false, 3: false };
const hitLineY = 500;

let audioContext, analyser, dataArray, source;

// --- 1. Robust File Handling ---
uploadInput.addEventListener('change', function(e) {
    const file = this.files[0];
    if (!file) return;

    startBtn.innerText = "Loading...";
    const reader = new FileReader();
    
    reader.onload = function(event) {
        audioPlayer.src = event.target.result;
        // Force the button to be enabled regardless of what the browser thinks
        startBtn.disabled = false;
        startBtn.innerText = "Play Track";
        console.log("File loaded into memory.");
    };
    
    reader.readAsDataURL(file);
});

// --- 2. The Mac Audio Unlocker ---
async function startLogic() {
    try {
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
            await audioContext.resume();
        }

        // Reset and Start
        score = 0;
        combo = 0;
        totalHits = 0;
        currentSpawnInterval = baseSpawnInterval;
        notes = [];
        updateScore();
        
        audioPlayer.play();
        isPlaying = true;
        requestAnimationFrame(gameLoop);
        
    } catch (err) {
        console.error("Audio failed to start:", err);
        alert("Please click the screen once, then try the Play button again.");
    }
}

startBtn.addEventListener('click', startLogic);

// --- 3. Hit Detection & Scaling ---
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keyMap[key] !== undefined && !activeKeys[keyMap[key]]) {
        activeKeys[keyMap[key]] = true;
        handleHit(keyMap[key]);
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keyMap[key] !== undefined) activeKeys[keyMap[key]] = false;
});

function handleHit(lane) {
    const laneNotes = notes.filter(n => n.lane === lane);
    if (laneNotes.length === 0) return;

    const targetNote = laneNotes[0];
    const distance = Math.abs(targetNote.y - hitLineY);

    if (distance <= 70) {
        totalHits++;
        combo++;
        
        if (distance <= 35) {
            score += 300;
            showJudgement("PERFECT", "#ff007f");
        } else {
            score += 100;
            showJudgement("GOOD", "#ff66b2");
        }

        // 20 Hit Difficulty Scaling (-25ms)
        if (totalHits > 0 && totalHits % 20 === 0) {
            currentSpawnInterval = Math.max(75, currentSpawnInterval - 25);
            showJudgement("SPEED UP!!", "#00ffcc");
        }

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
    if (score > highScore) {
        highScore = score;
        highscoreEl.innerText = highScore;
        localStorage.setItem('cvnmHighScore', highScore);
    }
}

// --- 4. Main Loop ---
function spawnNotes(timestamp) {
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);
    let bassAvg = (dataArray[0] + dataArray[1] + dataArray[2]) / 3;

    if (bassAvg > 195 && timestamp - lastSpawnTime > currentSpawnInterval) {
        notes.push({ lane: Math.floor(Math.random() * 4), y: -20 });
        lastSpawnTime = timestamp;
    }
}

function gameLoop(timestamp) {
    if (!isPlaying) return;
    
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Hit Line
    ctx.fillStyle = "#444";
    ctx.fillRect(0, hitLineY, canvas.width, 4);

    // Lanes
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = "#222";
        ctx.strokeRect(i * 100, 0, 100, canvas.height);
        if (activeKeys[i]) {
            ctx.fillStyle = "rgba(255, 0, 127, 0.4)";
            ctx.fillRect(i * 100, 0, 100, canvas.height);
        }
    }

    // Notes
    for (let i = notes.length - 1; i >= 0; i--) {
        let note = notes[i];
        note.y += noteSpeed;

        ctx.fillStyle = "#ff007f";
        ctx.fillRect(note.lane * 100 + 5, note.y, 90, 25);
        ctx.fillStyle = "#fff";
        ctx.fillRect(note.lane * 100 + 5, note.y + 20, 90, 5);

        if (note.y > canvas.height) {
            combo = 0;
            showJudgement("MISS", "#ff3333");
            updateScore();
            notes.splice(i, 1);
        }
    }

    spawnNotes(timestamp);
    requestAnimationFrame(gameLoop);
}
