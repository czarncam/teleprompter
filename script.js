// Navegación
const navEditor = document.getElementById('navEditor');
const navPrompter = document.getElementById('navPrompter');
const navGallery = document.getElementById('navGallery');
const secEditor = document.getElementById('section-editor');
const secPrompter = document.getElementById('section-prompter');
const secGallery = document.getElementById('section-gallery');
const btnGoToPrompter = document.getElementById('btnGoToPrompter');

// Teleprompter
const btnPlay = document.getElementById('btnPlay');
const btnReset = document.getElementById('btnReset');
const btnRecord = document.getElementById('btnRecord');
const btnPauseRec = document.getElementById('btnPauseRec');
const btnStopRec = document.getElementById('btnStopRec');
const btnMirror = document.getElementById('btnMirror');
const speedInput = document.getElementById('speed');
const fontSizeInput = document.getElementById('fontSize');
const textInput = document.getElementById('textInput');
const prompterDisplay = document.getElementById('prompter-display');
const prompterText = document.getElementById('prompter-text');
const video = document.getElementById('cameraPreview');

// Galería
const galleryGrid = document.getElementById('galleryGrid');
const emptyGalleryMsg = document.getElementById('emptyGalleryMsg');
const videoCount = document.getElementById('videoCount');

let isPlaying = false;
let scrollInterval = null;
let scrollAccumulator = 0;
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let dbVideos = [];

// INICIALIZACIÓN
navEditor.addEventListener('click', () => switchSection('editor'));
navPrompter.addEventListener('click', () => switchSection('prompter'));
navGallery.addEventListener('click', () => switchSection('gallery'));
btnGoToPrompter.addEventListener('click', () => switchSection('prompter'));

function switchSection(target) {
  [secEditor, secPrompter, secGallery].forEach(s => s.style.display = 'none');
  [navEditor, navPrompter, navGallery].forEach(n => n.classList.remove('active-nav'));

  if (target === 'editor') {
    secEditor.style.display = 'flex';
    navEditor.classList.add('active-nav');
    stopCamera();
  } else if (target === 'prompter') {
    secPrompter.style.display = 'block';
    navPrompter.classList.add('active-nav');
    prompterText.textContent = textInput.value || "Ingresa un texto en el editor...";
    startCamera();
  } else if (target === 'gallery') {
    secGallery.style.display = 'block';
    navGallery.classList.add('active-nav');
    stopCamera();
    renderGallery();
  }
}

// CÁMARA (Compatible con iOS Safari)
async function startCamera() {
  if (mediaStream) return;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: true
    });
    if (video) {
      video.srcObject = mediaStream;
      // Forzado de reproducción para iOS Safari
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.muted = true;
      await video.play();
    }
  } catch (err) {
    console.error('Error al acceder a la cámara/micrófono: ', err);
  }
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
    video.srcObject = null;
  }
}

// DESPLAZAMIENTO DEL TELEPROMPTER (Compatibilidad iOS)
btnPlay.addEventListener('click', togglePlay);
btnReset.addEventListener('click', resetScroll);
btnMirror.addEventListener('click', () => prompterText.classList.toggle('mirror'));
fontSizeInput.addEventListener('input', (e) => {
  prompterText.style.fontSize = `${e.target.value}px`;
});

function togglePlay() {
  if (!isPlaying) {
    isPlaying = true;
    btnPlay.textContent = '⏸ Pausa';
    
    // Forzar foco táctil/scroll en iOS
    prompterDisplay.style.webkitOverflowScrolling = 'touch';
    
    scrollInterval = setInterval(() => {
      scrollAccumulator += parseFloat(speedInput.value);
      if (scrollAccumulator >= 1) {
        prompterDisplay.scrollTop += Math.floor(scrollAccumulator);
        scrollAccumulator %= 1;
      }
    }, 30);
  } else {
    isPlaying = false;
    btnPlay.textContent = '▶ Continuar';
    clearInterval(scrollInterval);
  }
}

function resetScroll() {
  isPlaying = false;
  clearInterval(scrollInterval);
  btnPlay.textContent = '▶ Iniciar Lectura';
  prompterDisplay.scrollTop = 0;
}

// GRABACIÓN FLEXIBLE
btnRecord.addEventListener('click', startRecording);
btnPauseRec.addEventListener('click', pauseRecording);
btnStopRec.addEventListener('click', stopRecording);

function startRecording() {
  if (!mediaStream) return;
  recordedChunks = [];
  
  let options = { mimeType: 'video/webm' };
  if (!MediaRecorder.isTypeSupported('video/webm')) {
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      options = { mimeType: 'video/mp4' };
    } else {
      options = {};
    }
  }

  try {
    mediaRecorder = new MediaRecorder(mediaStream, options);
  } catch (e) {
    mediaRecorder = new MediaRecorder(mediaStream);
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = saveToGallery;
  mediaRecorder.start();

  btnRecord.style.display = 'none';
  btnPauseRec.style.display = 'inline-block';
  btnStopRec.style.display = 'inline-block';
}

function pauseRecording() {
  if (!mediaRecorder) return;
  if (mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    btnPauseRec.textContent = '▶ Continuar Rec';
  } else if (mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
    btnPauseRec.textContent = '⏸ Pausar Rec';
  }
}

function stopRecording() {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  btnRecord.style.display = 'inline-block';
  btnPauseRec.style.display = 'none';
  btnStopRec.style.display = 'none';
  btnPauseRec.textContent = '⏸ Pausar Rec';
}

// GALERÍA LOCAL
function saveToGallery() {
  const mime = recordedChunks[0]?.type || 'video/mp4';
  const blob = new Blob(recordedChunks, { type: mime });
  const videoUrl = URL.createObjectURL(blob);
  const videoItem = {
    id: Date.now(),
    url: videoUrl,
    date: new Date().toLocaleString(),
    ext: mime.includes('mp4') ? 'mp4' : 'webm'
  };
  
  dbVideos.unshift(videoItem);
  videoCount.textContent = dbVideos.length;
}

function renderGallery() {
  galleryGrid.innerHTML = '';
  if (dbVideos.length === 0) {
    galleryGrid.appendChild(emptyGalleryMsg);
    return;
  }

  dbVideos.forEach(item => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `
      <video src="${item.url}" controls playsinline></video>
      <small>${item.date}</small>
      <div class="card-actions">
        <a href="${item.url}" download="grabacion_${item.id}.${item.ext}">
          <button class="btn-download">💾 Descargar</button>
        </a>
        <button class="btn-delete" onclick="deleteVideo(${item.id})">🗑 Eliminar</button>
      </div>
    `;
    galleryGrid.appendChild(card);
  });
}

window.deleteVideo = function(id) {
  dbVideos = dbVideos.filter(item => item.id !== id);
  videoCount.textContent = dbVideos.length;
  renderGallery();
};

// Teclado
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement !== textInput && secPrompter.style.display !== 'none') {
    e.preventDefault();
    togglePlay();
  }
});

// PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
