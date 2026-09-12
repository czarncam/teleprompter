const btnPlay = document.getElementById('btnPlay');
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

// Función para activar la cámara frontal
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });
    if (video) {
      video.srcObject = stream;
    }
  } catch (err) {
    console.error('Error al acceder a la cámara: ', err);
  }
}

btnPlay.addEventListener('click', togglePlay);
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
      
      // Activa la cámara al iniciar la lectura por primera vez
      if (video && !video.srcObject) {
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
  prompterDisplay.scrollTop = 0;
  prompterDisplay.style.display = 'none';
  editorContainer.style.display = 'block';
}

// Control por teclado (Espacio para pausar/iniciar)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement !== textInput) {
    e.preventDefault();
    togglePlay();
  }
});

// Registrar Service Worker para funcionamiento sin conexión (PWA)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
