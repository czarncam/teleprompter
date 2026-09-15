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
const btnStopRec = document.getElementById('btnStopRec');
const btnSwitchCam = document.getElementById('btnSwitchCam');
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
let animationFrameId = null;
let lastTimeStamp = 0;
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let dbVideos = [];
let currentFacingMode = 'user';
let isRecording = false;

// INICIALIZACIÓN DE NAVEGACIÓN
navEditor.addEventListener('click', () => switchSection('editor'));
navPrompter.addEventListener('click', () => switchSection('prompter'));
navGallery.addEventListener('click', () => switchSection('gallery'));
btnGoToPrompter.addEventListener('click', () => switchSection('prompter'));

function switchSection(target) {
  [secEditor, secPrompter, secGallery].forEach(s => s.style.display = 'none');
  [navEditor, navPrompter, navGallery].forEach(n => n.classList.remove('active-nav'));

  if (target === 'editor') {
    secEditor.style.display = 'block';
    navEditor.classList.add('active-nav');
    stopCamera();
    stopScroll();
  } else if (target === 'prompter') {
    secPrompter.style.display = 'block';
    navPrompter.classList.add('active-nav');
    prompterText.textContent = textInput.value || "Ingresa un texto en el editor...";
    startCamera();
  } else if (target === 'gallery') {
    secGallery.style.display = 'block';
    navGallery.classList.add('active-nav');
    stopCamera();
    stopScroll();
    renderGallery();
  }
}

// INICIALIZACIÓN DE CÁMARA
async function startCamera() {
  stopCamera();
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: currentFacingMode,
        width: { ideal: 1280 }, 
        height: { ideal: 720 } 
      },
      audio: true
    });

    if (video && mediaStream) {
      video.srcObject = mediaStream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;
      await video.play();
    }
  } catch (err) {
    console.error('Error al inicializar cámara: ', err);
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (video) {
        video.srcObject = mediaStream;
        await video.play();
      }
    } catch (e) {
      alert('No se pudo acceder a la cámara.');
    }
  }
}

function stopCamera() {
  if (mediaStream && !isRecording) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
    if (video) video.srcObject = null;
  }
}

// CAMBIO DE CÁMARA (DETIENE GRABACIÓN ANTERIOR SI ESTÁ ACTIVA)
btnSwitchCam.addEventListener('click', async () => {
  if (isRecording) {
    stopRecording();
  }
  currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
  await startCamera();
});

// DESPLAZAMIENTO DEL TEXTO
btnPlay.addEventListener('click', togglePlay);
btnReset.addEventListener('click', resetScroll);
btnMirror.addEventListener('click', () => prompterText.classList.toggle('mirror'));
fontSizeInput.addEventListener('input', (e) => {
  prompterText.style.fontSize = `${e.target.value}px`;
});

function step(timestamp) {
  if (!lastTimeStamp) lastTimeStamp = timestamp;
  const progress = timestamp - lastTimeStamp;

  if (progress > 20) {
    const speed = parseFloat(speedInput.value);
    prompterDisplay.scrollTop += speed * (progress / 16.6);
    lastTimeStamp = timestamp;
  }

  if (isPlaying) {
    animationFrameId = requestAnimationFrame(step);
  }
}

function togglePlay() {
  if (!isPlaying) {
    isPlaying = true;
    btnPlay.textContent = '⏸ Pausa';
    lastTimeStamp = 0;
    animationFrameId = requestAnimationFrame(step);
  } else {
    stopScroll();
  }
}

function stopScroll() {
  isPlaying = false;
  btnPlay.textContent = '▶ Leer';
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function resetScroll() {
  stopScroll();
  prompterDisplay.scrollTop = 0;
}

// DETERMINAR FORMATO COMPATIBLE CON IOS / ANDROID
function getSupportedMimeType() {
  const types = [
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=h264',
    'video/webm'
  ];
  for (let type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

// GRABACIÓN
btnRecord.addEventListener('click', startRecording);
btnStopRec.addEventListener('click', stopRecording);

function startRecording() {
  if (!mediaStream) return;
  recordedChunks = [];
  isRecording = true;
  
  const mimeType = getSupportedMimeType();
  const options = mimeType ? { mimeType } : {};

  try {
    mediaRecorder = new MediaRecorder(mediaStream, options);
  } catch (e) {
    mediaRecorder = new MediaRecorder(mediaStream);
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = processAndSaveVideo;
  mediaRecorder.start(1000);

  btnRecord.style.display = 'none';
  btnStopRec.style.display = 'flex';
}

function stopRecording() {
  if (!mediaRecorder) return;
  isRecording = false;
  mediaRecorder.stop();
  btnRecord.style.display = 'flex';
  btnStopRec.style.display = 'none';
}

// CAPTURA DE MINIATURA MEDIANTE CANVAS (COMPATIBILIDAD 100% IOS / SAFARI)
async function processAndSaveVideo() {
  const mimeType = mediaRecorder.mimeType || 'video/mp4';
  const isMp4 = mimeType.includes('mp4');
  const ext = isMp4 ? 'mp4' : 'webm';
  
  const blob = new Blob(recordedChunks, { type: mimeType });
  const videoUrl = URL.createObjectURL(blob);

  // Generar foto miniatura desde la cámara actual mediante Canvas
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 360;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);

  const videoItem = {
    id: Date.now(),
    url: videoUrl,
    thumb: thumbnailUrl,
    date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ext: ext
  };
  
  dbVideos.unshift(videoItem);
  videoCount.textContent = dbVideos.length;
}

// RENDRERIZADO DE GALERÍA DE MINIATURAS
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
      <div class="thumb-wrapper" onclick="playVideoModal('${item.url}')">
        <img src="${item.thumb}" class="thumb-img" alt="Miniatura">
        <div class="play-overlay">▶</div>
      </div>
      <div class="card-info">
        <small>${item.date} (${item.ext.toUpperCase()})</small>
        <div class="card-actions">
          <button class="btn-download" onclick="downloadVideo(${item.id})">💾 Guardar</button>
          <button class="btn-delete" onclick="deleteVideo(${item.id})">🗑 Borrar</button>
        </div>
      </div>
    `;
    galleryGrid.appendChild(card);
  });
}

// MODAL DE REPRODUCCIÓN
const videoModal = document.getElementById('videoModal');
const modalVideoPlayer = document.getElementById('modalVideoPlayer');
const btnCloseModal = document.getElementById('btnCloseModal');

window.playVideoModal = function(url) {
  if (videoModal && modalVideoPlayer) {
    modalVideoPlayer.src = url;
    videoModal.style.display = 'flex';
    modalVideoPlayer.play().catch(() => {});
  }
};

function closeModal() {
  if (videoModal && modalVideoPlayer) {
    modalVideoPlayer.pause();
    modalVideoPlayer.src = '';
    videoModal.style.display = 'none';
  }
}

btnCloseModal.addEventListener('click', closeModal);

// Cerrar también si se toca el fondo fuera del video
videoModal.addEventListener('click', (e) => {
  if (e.target === videoModal) {
    closeModal();
  }
});

// TECLADO
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement !== textInput && secPrompter.style.display !== 'none') {
    e.preventDefault();
    togglePlay();
  }
});

// SERVICE WORKER
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
