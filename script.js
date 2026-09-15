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
let rawCameraStream = null;
let recordStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let dbVideos = [];
let selectedMimeType = '';
let currentFacingMode = 'user';
let isRecording = false;

// CANVAS DE DIBUJO PARA GRABACIÓN CONTINUA
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
let canvasAnimId = null;

function renderCanvas() {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
  canvasAnimId = requestAnimationFrame(renderCanvas);
}

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

// CÁMARA
async function startCamera() {
  stopCameraTracks();
  try {
    rawCameraStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: currentFacingMode,
        width: { ideal: 1280 }, 
        height: { ideal: 720 } 
      },
      audio: true
    });

    if (video && rawCameraStream) {
      video.srcObject = rawCameraStream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;
      await video.play();
      
      if (!canvasAnimId) renderCanvas();
    }
  } catch (err) {
    console.error('Error al acceder a la cámara: ', err);
  }
}

function stopCameraTracks() {
  if (rawCameraStream) {
    rawCameraStream.getTracks().forEach(track => track.stop());
    rawCameraStream = null;
  }
}

function stopCamera() {
  if (!isRecording) {
    stopCameraTracks();
    if (video) video.srcObject = null;
    if (canvasAnimId) {
      cancelAnimationFrame(canvasAnimId);
      canvasAnimId = null;
    }
  }
}

// CAMBIO DE CÁMARA FLUIDO SIN DETENER GRABACIÓN
btnSwitchCam.addEventListener('click', async () => {
  currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';

  // Solo reiniciamos la captura de hardware, el stream del Canvas permanece intacto
  stopCameraTracks();

  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: currentFacingMode,
        width: { ideal: 1280 }, 
        height: { ideal: 720 } 
      },
      audio: true
    });

    rawCameraStream = newStream;
    if (video) {
      video.srcObject = rawCameraStream;
      await video.play();
    }
  } catch (err) {
    console.error('Error al cambiar de cámara: ', err);
  }
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
  btnPlay.textContent = '▶ Iniciar Lectura';
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function resetScroll() {
  stopScroll();
  prompterDisplay.scrollTop = 0;
}

// FORMATOS
function getSupportedMimeType() {
  const types = [
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=h264',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ];
  for (let type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

// GRABACIÓN CONTINUA VIA CANVAS + AUDIO
btnRecord.addEventListener('click', startRecording);
btnPauseRec.addEventListener('click', pauseRecording);
btnStopRec.addEventListener('click', stopRecording);

function startRecording() {
  if (!rawCameraStream) return;
  recordedChunks = [];
  isRecording = true;

  // 1. Extraer stream continuo del Canvas a 30 FPS
  const canvasStream = canvas.captureStream(30);

  // 2. Extraer audio de la cámara e integrarlo al Stream de grabación
  const audioTrack = rawCameraStream.getAudioTracks()[0];
  if (audioTrack) {
    canvasStream.addTrack(audioTrack);
  }

  recordStream = canvasStream;
  selectedMimeType = getSupportedMimeType();
  const options = selectedMimeType ? { mimeType: selectedMimeType } : {};

  try {
    mediaRecorder = new MediaRecorder(recordStream, options);
  } catch (e) {
    mediaRecorder = new MediaRecorder(recordStream);
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = saveToGallery;
  mediaRecorder.start(1000);

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
  isRecording = false;
  mediaRecorder.stop();
  btnRecord.style.display = 'inline-block';
  btnPauseRec.style.display = 'none';
  btnStopRec.style.display = 'none';
  btnPauseRec.textContent = '⏸ Pausar Rec';
}

// GALERÍA
function saveToGallery() {
  const actualType = mediaRecorder.mimeType || selectedMimeType || 'video/mp4';
  const isMp4 = actualType.includes('mp4');
  const extension = isMp4 ? 'mp4' : 'webm';
  
  const blob = new Blob(recordedChunks, { type: actualType });
  const videoUrl = URL.createObjectURL(blob);
  
  const videoItem = {
    id: Date.now(),
    url: videoUrl,
    date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ext: extension
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
    
    // Agregamos evento onloadeddata="this.currentTime=0.1" para cargar la miniatura inmediatamente
    card.innerHTML = `
      <video src="${item.url}#t=0.1" controls playsinline webkit-playsinline preload="metadata" onloadeddata="this.currentTime=0.1"></video>
      <small>${item.date} (${item.ext.toUpperCase()})</small>
      <div class="card-actions">
        <button class="btn-download" onclick="downloadVideo(${item.id})">💾 Guardar</button>
        <button class="btn-delete" onclick="deleteVideo(${item.id})">🗑 Borrar</button>
      </div>
    `;
    galleryGrid.appendChild(card);
  });
}

window.downloadVideo = function(id) {
  const item = dbVideos.find(v => v.id === id);
  if (!item) return;

  const a = document.createElement('a');
  a.href = item.url;
  a.download = `teleprompter_${item.id}.${item.ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

window.deleteVideo = function(id) {
  dbVideos = dbVideos.filter(item => item.id !== id);
  videoCount.textContent = dbVideos.length;
  renderGallery();
};

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
