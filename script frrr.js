const lanes = document.querySelectorAll('.lane');
const audioElement = document.getElementById('audio');
const audioFileInput = document.getElementById('audioFile');
const audioUrlInput = document.getElementById('audioUrl');
const loadBtn = document.getElementById('loadBtn');
const startBtn = document.getElementById('startBtn');
const scoreElement = document.getElementById('score');
const layoutElement = document.getElementById('layout');

let audioContext;
let analyser;
let source;
let notes = [];
let score = 0;
let isPlaying = false;
let startTime;
let audioBuffer;
let beatTimes = [];

// Simple onset detection function
async function detectBeats(buffer) {
    const offlineContext = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
    const offlineSource = offlineContext.createBufferSource();
    offlineSource.buffer = buffer;
    const lowpass = offlineContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 150;
    offlineSource.connect(lowpass);
    lowpass.connect(offlineContext.destination);
    offlineSource.start(0);
    await offlineContext.startRendering();
    
    const channelData = buffer.getChannelData(0);
    const frameSize = 1024;
    const beats = [];
    let prevEnergy = 0;
    for (let i = 0; i < channelData.length; i += frameSize) {
        let energy = 0;
        for (let j = 0; j < frameSize; j++) {
            if (i + j < channelData.length) {
                energy += channelData[i + j] ** 2;
            }
        }
        energy = Math.sqrt(energy / frameSize);
        if (energy > 0.1 && energy > prevEnergy * 1.2) { // Simple threshold and peak detection
            beats.push(i / buffer.sampleRate);
        }
        prevEnergy = energy;
    }
    return beats;
}

// Generate notes from beat times
function generateMap(beats) {
    notes = [];
    beats.forEach(time => {
        const laneIndex = Math.floor(Math.random() * 4);
        notes.push({ time, lane: laneIndex, hit: false });
    });
}

// Load audio and generate map
async function loadAudio() {
    let url;
    if (audioFileInput.files.length > 0) {
        url = URL.createObjectURL(audioFileInput.files[0]);
    } else if (audioUrlInput.value) {
        url = audioUrlInput.value;
    } else {
        alert('Provide an audio file or URL!');
        return;
    }
    
    audioElement.src = url;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    audioContext = new AudioContext();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    beatTimes = await detectBeats(audioBuffer);
    generateMap(beatTimes);
    startBtn.disabled = false;
    alert(`Map generated with ${notes.length} notes!`);
}

// Start game
function startGame() {
    if (isPlaying) return;
    isPlaying = true;
    layoutElement.style.display = 'block';
    score = 0;
    scoreElement.textContent = `Score: ${score}`;
    audioElement.currentTime = 0;
    audioElement.play();
    startTime = performance.now() - audioElement.currentTime * 1000;
    requestAnimationFrame(update);
}

// Update loop for notes
function update() {
    if (!isPlaying) return;
    const currentTime = (performance.now() - startTime) / 1000;
    
    notes.forEach(note => {
        if (!note.element && currentTime > note.time - 2) { // 2s fall time
            const noteElem = document.createElement('div');
            noteElem.classList.add('note');
            lanes[note.lane].appendChild(noteElem);
            note.element = noteElem;
        }
        if (note.element) {
            const pos = (currentTime - (note.time - 2)) / 2 * 100; // Percent fallen
            if (pos > 100) {
                note.element.remove();
                if (!note.hit) {
                    // Miss
                }
            } else {
                note.element.style.top = `${pos}%`;
            }
        }
    });
    
    if (currentTime >= audioBuffer.duration) {
        endGame();
    } else {
        requestAnimationFrame(update);
    }
}

function endGame() {
    isPlaying = false;
    layoutElement.style.display = 'none';
    notes.forEach(note => {
        if (note.element) note.element.remove();
    });
    alert(`Game over! Final score: ${score}`);
}

// Key press handling
document.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    const key = e.key.toLowerCase();
    const laneMap = { c: 0, v: 1, n: 2, m: 3 };
    const laneIndex = laneMap[key];
    if (laneIndex === undefined) return;
    
    const currentTime = (performance.now() - startTime) / 1000;
    notes.forEach(note => {
        if (!note.hit && note.lane === laneIndex) {
            const hitDiff = Math.abs(currentTime - note.time);
            if (hitDiff < 0.2) { // 200ms window
                score += 100;
                scoreElement.textContent = `Score: ${score}`;
                note.hit = true;
                note.element.style.backgroundColor = '#0f0'; // Hit color
                setTimeout(() => note.element.remove(), 100);
            }
        }
    });
});

loadBtn.addEventListener('click', loadAudio);
startBtn.addEventListener('click', startGame);

// Add hit zones visually
lanes.forEach(lane => {
    const hitZone = document.createElement('div');
    hitZone.classList.add('hit-zone');
    lane.appendChild(hitZone);
});
