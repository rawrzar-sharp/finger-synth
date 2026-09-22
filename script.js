const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const statusDiv = document.getElementById('status');

let audioCtx = null;
let oscillator = null;
let gainNode = null;
let isAudioPlaying = false;

// Initialize Web Audio API
function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  oscillator = audioCtx.createOscillator();
  gainNode = audioCtx.createGain();

  oscillator.type = 'sine'; // Sound wave type: sine, square, sawtooth, triangle
  oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // Base pitch: 220Hz
  
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime); // Start muted

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  isAudioPlaying = true;
}

// Set canvas dimensions
canvasElement.width = 640;
canvasElement.height = 480;

// MediaPipe Hand Tracking Setup
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults(onResults);

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];

    // Landmark 4 = Thumb Tip, Landmark 8 = Index Finger Tip
    const thumb = landmarks[4];
    const index = landmarks[8];

    // Calculate Euclidean distance between Thumb Tip and Index Tip
    const dx = (thumb.x - index.x) * canvasElement.width;
    const dy = (thumb.y - index.y) * canvasElement.height;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Map distance to Frequency pitch (100Hz to 1000Hz)
    const minDist = 30;
    const maxDist = 300;
    const clampedDist = Math.max(minDist, Math.min(maxDist, distance));
    const frequency = 100 + ((clampedDist - minDist) / (maxDist - minDist)) * 900;

    // Update audio pitch and volume
    if (audioCtx) {
      oscillator.frequency.setTargetAtTime(frequency, audioCtx.currentTime, 0.05);
      gainNode.gain.setTargetAtTime(0.3, audioCtx.currentTime, 0.05); // Unmute / adjust volume
    }

    // Convert normalized coordinates to screen pixel positions
    const x1 = thumb.x * canvasElement.width;
    const y1 = thumb.y * canvasElement.height;
    const x2 = index.x * canvasElement.width;
    const y2 = index.y * canvasElement.height;

    // Visual: Draw connecting line between fingers
    canvasCtx.beginPath();
    canvasCtx.moveTo(x1, y1);
    canvasCtx.lineTo(x2, y2);
    canvasCtx.lineWidth = Math.max(2, distance / 15);
    canvasCtx.strokeStyle = `hsl(${frequency / 3}, 100%, 50%)`;
    canvasCtx.stroke();

    // Visual: Draw glowing circles at key points
    drawGlowingCircle(x1, y1, 12, `hsl(${frequency / 3}, 100%, 50%)`);
    drawGlowingCircle(x2, y2, 12, `hsl(${frequency / 3}, 100%, 50%)`);

    statusDiv.innerText = `Pitch: ${Math.round(frequency)} Hz | Stretch: ${Math.round(distance)} px`;
  } else {
    // Mute sound when no hand is detected
    if (audioCtx) {
      gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    }
    statusDiv.innerText = "Status: Show your hand to the camera";
  }

  canvasCtx.restore();
}

function drawGlowingCircle(x, y, radius, color) {
  canvasCtx.beginPath();
  canvasCtx.arc(x, y, radius, 0, 2 * Math.PI);
  canvasCtx.fillStyle = color;
  canvasCtx.shadowColor = color;
  canvasCtx.shadowBlur = 15;
  canvasCtx.fill();
}

// Initialize webcam
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480
});

startBtn.addEventListener('click', () => {
  if (!isAudioPlaying) {
    initAudio();
  }
  camera.start();
  startBtn.style.display = 'none';
  statusDiv.innerText = "Status: Camera active, detecting hand...";
});