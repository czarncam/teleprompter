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
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let dbVideos = [];
let selectedMimeType = '';
let currentFacingMode = 'user';
let isRecording = false;

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

// CÁMARA INICIALIZACIÓN
async function startCamera() {
  stopCamera();
  try {
    // Eliminamos 'exact' en la inicialización para mayor compatibilidad con dispositivos Android/iOS
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
    console.error('Error al acceder a la cámara: ', err);
    // Fallback general si falla la configuración específica
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (video && mediaStream) {
        video.srcObject = mediaStream;
        await video.play();
      }
    } catch (e) {
      console.error('Error fatal al acceder a cualquier cámara: ', e);
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

// CAMBIO DE CÁMARA COMPATIBLE EN TIEMPO REAL (IOS Y ANDROID)
btnSwitchCam.addEventListener('click', async () => {
  currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';

  if (isRecording && mediaRecorder && mediaStream) {
    try {
      // 1. Pausar la grabación para prevenir la corrupción del archivo en iOS/Android
      let isPausedBySwitch = false;
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        isPausedBySwitch = true;
      }

      // 2. Intentar solicitar la nueva cámara
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: currentFacingMode } },
          audio: false
        });
      } catch (e) {
        // Fallback sin 'exact' en caso de no soportar la restricción estricta
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: currentFacingMode },
          audio: false
        });
      }

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = mediaStream.getVideoTracks()[0];

      // 3. Reemplazar pista de video sin detener el stream principal ni la grabación
      mediaStream.removeTrack(oldVideoTrack);
      oldVideoTrack.stop();
      mediaStream.addTrack(newVideoTrack);

      if (video) video.srcObject = mediaStream;

      // 4. Pausa de 500ms para estabilizar la autoexposición y balance de blancos antes de reanudar
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'paused' && isPausedBySwitch) {
          mediaRecorder.resume();
        }
      }, 500);

    } catch (err) {
      console.error('Error al cambiar de cámara en caliente: ', err);
    }
  } else {
    await startCamera();
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

// GRABACIÓN CONTINUA
btnRecord.addEventListener('click', startRecording);
btnPauseRec.addEventListener('click', pauseRecording);
btnStopRec.addEventListener('click', stopRecording);

function startRecording() {
  if (!mediaStream) return;
  recordedChunks = [];
  isRecording = true;
  
  selectedMimeType = getSupportedMimeType();
  const options = selectedMimeType ? { mimeType: selectedMimeType } : {};

  try {
    mediaRecorder = new MediaRecorder(mediaStream, options);
  } catch (e) {
    mediaRecorder = new MediaRecorder(mediaStream);
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
    card.innerHTML = `
      <video src="${item.url}" controls playsinline webkit-playsinline preload="metadata"></video>
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
