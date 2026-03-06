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
let highScore = localStorage.getItem('cvnmHighScore') || 0;
highscoreEl.innerText = highScore;

const keyMap = { 'c': 0, 'v': 1, 'n': 2, 'm': 3 };
const activeKeys = { 0: false, 1: false, 2: false, 3: false };
const hitLineY = 500;

let audioContext, analyser, dataArray, source;

// Enhanced File Upload Logic
uploadInput.addEventListener('change', function(e) {
    const file = this.files[0];
    if (file) {
        startBtn.innerText = "Loading Audio...";
        startBtn.disabled = true;

        const objectURL = URL.createObjectURL(file);
        audioPlayer.src = objectURL;

        // Ensure the browser has loaded the MP3 before allowing play
        audioPlayer.oncanplaythrough = () => {
            startBtn.disabled = false;
            startBtn.innerText = "Play: " + file.name.substring(0, 15) + "...";
            console.log("File ready:", file.name);
        };

        audioPlayer.onerror = () => {
            startBtn.innerText = "Invalid File";
            console.error("The browser could not play this file.");
        };
    }
});

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
    
    if (audioContext.state === 'suspended') audioContext.resume();

    score = 0;
    combo = 0;
    notes = [];
    updateScore();
    judgementEl.innerText = "";
    
    audioPlayer.play();
    isPlaying = true;
    requestAnimationFrame(gameLoop);
});

// The Beat Detection Algorithm
function spawnNotes(timestamp) {
    analyser.getByteFrequencyData(dataArray);
    
    // Analyzing low-end frequencies for the "Gigolo" beat spikes
    let bassSum = 0;
    for (let i = 0; i < 5; i++) { bassSum += dataArray[i]; }
    let bassAvg = bassSum / 5;

    // Adjust the 190 value below if the map is too crowded or too empty
    if (bassAvg > 190 && timestamp - lastSpawnTime > 220) {
        const randomLane = Math.floor(Math.random() * 4);
        notes.push({ lane: randomLane, y: -20 });
        lastSpawnTime = timestamp;
    }
}

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
    if (keyMap[key] !== undefined) activeKeys[keyMap[key]] = false;
});

function handleHit(lane) {
    const laneNotes = notes.filter(n => n.lane === lane);
    if (laneNotes.length === 0) return;

    const targetNote = laneNotes[0];
    const distance = Math.abs(targetNote.y - hitLineY);

    if (distance <= 30) {
        score += 300;
        combo++;
        showJudgement("PERFECT", "#ff007f");
        removeNote(targetNote);
    } else if (distance <= 60) {
        score += 100;
        combo++;
        showJudgement("GOOD", "#ff66b2");
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

function gameLoop(timestamp) {
    if (!isPlaying) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render logic (Lanes/Notes)
    ctx.fillStyle = "#333";
    ctx.fillRect(0, hitLineY, canvas.width, 2);

    for (let i = 0; i < 4; i++) {
        if (activeKeys[i]) {
            ctx.fillStyle = "rgba(255, 0, 127, 0.3)";
            ctx.fillRect(i * 100, 0, 100, canvas.height);
        }
    }

    for (let i = notes.length - 1; i >= 0; i--) {
        let note = notes[i];
        note.y += noteSpeed;
        ctx.fillStyle = "#ff007f";
        ctx.fillRect(note.lane * 100 + 5, note.y, 90, 20);

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
