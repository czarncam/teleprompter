const btnPlay = document.getElementById('btnPlay');
const btnRecord = document.getElementById('btnRecord');
const btnMirror = document.getElementById('btnMirror');
const btnReset = document.getElementById('btnReset');
const speedInput = document.getElementById('speed');
const fontSizeInput = document.getElementById('fontSize');
const textInput = document.getElementById('textInput');
const prompterDisplay = document.getElementById('prompter-display');
const prompterText = document.getElementById('prompter-text');
const editorContainer = document.getElementById('editor-container');
const video = document.getElementById('cameraPreview');

let isPlaying = false;
let scrollInterval = null;
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

// Inicializa la cámara y el micrófono
async function startCamera() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: true
    });
    if (video) {
      video.srcObject = mediaStream;
      btnRecord.disabled = false;
    }
  } catch (err) {
    console.error('Error al acceder a la cámara/micrófono: ', err);
  }
}

btnPlay.addEventListener('click', togglePlay);
btnRecord.addEventListener('click', toggleRecording);
btnMirror.addEventListener('click', () => prompterText.classList.toggle('mirror'));
btnReset.addEventListener('click', resetPrompter);

fontSizeInput.addEventListener('input', (e) => {
  prompterText.style.fontSize = `${e.target.value}px`;
});

function togglePlay() {
  if (!isPlaying) {
    if (editorContainer.style.display !== 'none') {
      prompterText.textContent = textInput.value;
      editorContainer.style.display = 'none';
      prompterDisplay.style.display = 'block';
      prompterDisplay.scrollTop = 0; // Garantiza iniciar desde el renglón 1
      
      if (!mediaStream) {
        startCamera();
      }
    }
    isPlaying = true;
    btnPlay.textContent = '⏸ Pausa';
    scrollInterval = setInterval(() => {
      prompterDisplay.scrollTop += parseInt(speedInput.value);
    }, 30);
  } else {
    isPlaying = false;
    btnPlay.textContent = '▶ Continuar';
    clearInterval(scrollInterval);
  }
}

function resetPrompter() {
  isPlaying = false;
  clearInterval(scrollInterval);
  btnPlay.textContent = '▶ Iniciar / Pausa';
  
  if (isRecording) {
    toggleRecording();
  }
  
  prompterDisplay.scrollTop = 0;
  prompterDisplay.style.display = 'none';
  editorContainer.style.display = 'block';
}

function toggleRecording() {
  if (!mediaStream) return;

  if (!isRecording) {
    recordedChunks = [];
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    
    try {
      mediaRecorder = new MediaRecorder(mediaStream);
    } catch (e) {
      mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'video/mp4' });
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = saveVideo;
    mediaRecorder.start();
    isRecording = true;
    btnRecord.textContent = '⏹ Detener y Guardar';
    btnRecord.style.background = '#a00';
  } else {
    mediaRecorder.stop();
    isRecording = false;
    btnRecord.textContent = '🔴 Grabar';
    btnRecord.style.background = '#222';
  }
}

function saveVideo() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `grabacion_teleprompter_${Date.now()}.webm`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

// Control por teclado (Espacio para pausar/iniciar)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement !== textInput) {
    e.preventDefault();
    togglePlay();
  }
});

// Registrar Service Worker para offline (PWA)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
