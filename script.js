// Estado global de la aplicación
let recordedVideos = []; 
let mediaRecorder = null;
let recordedChunks = [];
let currentStream = null;
let prompterInterval = null;
let isPrompterRunning = false;
let currentFacingMode = 'user'; // 'user' para frontal, 'environment' para trasera

// Elementos del DOM
const navEditor = document.getElementById('navEditor');
const navPrompter = document.getElementById('navPrompter');
const navGallery = document.getElementById('navGallery');

const sectionEditor = document.getElementById('section-editor');
const sectionPrompter = document.getElementById('section-prompter');
const sectionGallery = document.getElementById('section-gallery');

const textInput = document.getElementById('textInput');
const btnGoToPrompter = document.getElementById('btnGoToPrompter');
const prompterDisplay = document.getElementById('prompter-display');
const prompterText = document.getElementById('prompter-text');
const cameraPreview = document.getElementById('cameraPreview');

const speedInput = document.getElementById('speed');
const fontSizeInput = document.getElementById('fontSize');
const btnMirror = document.getElementById('btnMirror');

const btnReset = document.getElementById('btnReset');
const btnPlay = document.getElementById('btnPlay');
const btnRecord = document.getElementById('btnRecord');
const btnStopRec = document.getElementById('btnStopRec');
const btnSwitchCam = document.getElementById('btnSwitchCam');

const videoModal = document.getElementById('videoModal');
const modalVideoPlayer = document.getElementById('modalVideoPlayer');
const btnCloseModal = document.getElementById('btnCloseModal');

// 1. NAVEGACIÓN ENTRE SECCIONES
function showSection(sectionToShow, activeBtn) {
  [sectionEditor, sectionPrompter, sectionGallery].forEach(sec => {
    if (sec) sec.style.display = 'none';
  });
  [navEditor, navPrompter, navGallery].forEach(btn => {
    if (btn) btn.classList.remove('active-nav');
  });

  if (sectionToShow) sectionToShow.style.display = 'block';
  if (activeBtn) activeBtn.classList.add('active-nav');

  if (sectionToShow === sectionPrompter) {
    startCamera();
  } else {
    stopCamera();
    stopPrompter();
  }

  if (sectionToShow === sectionGallery) {
    renderGallery();
  }
}

navEditor.addEventListener('click', () => showSection(sectionEditor, navEditor));
navPrompter.addEventListener('click', () => showSection(sectionPrompter, navPrompter));
navGallery.addEventListener('click', () => showSection(sectionGallery, navGallery));

btnGoToPrompter.addEventListener('click', () => {
  prompterText.textContent = textInput.value || 'Escribe tu guion en el editor...';
  showSection(sectionPrompter, navPrompter);
});

// 2. CONTROL DE CÁMARA
async function startCamera() {
  stopCamera();
  try {
    const constraints = {
      video: { facingMode: currentFacingMode },
      audio: true
    };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraPreview.srcObject = currentStream;
  } catch (err) {
    console.error("Error al acceder a la cámara:", err);
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
}

btnSwitchCam.addEventListener('click', () => {
  currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
  startCamera();
});

// 3. TELEPROMPTER
function togglePrompter() {
  if (isPrompterRunning) {
    stopPrompter();
  } else {
    startPrompter();
  }
}

function startPrompter() {
  if (isPrompterRunning) return;
  isPrompterRunning = true;
  btnPlay.textContent = '⏸ Pausa';

  const speed = parseFloat(speedInput.value) || 1;
  prompterInterval = setInterval(() => {
    prompterDisplay.scrollTop += speed;
  }, 20);
}

function stopPrompter() {
  isPrompterRunning = false;
  if (btnPlay) btnPlay.textContent = '▶ Leer';
  if (prompterInterval) {
    clearInterval(prompterInterval);
    prompterInterval = null;
  }
}

btnPlay.addEventListener('click', togglePrompter);

btnReset.addEventListener('click', () => {
  stopPrompter();
  prompterDisplay.scrollTop = 0;
});

fontSizeInput.addEventListener('input', (e) => {
  prompterText.style.fontSize = `${e.target.value}px`;
});

btnMirror.addEventListener('click', () => {
  prompterText.classList.toggle('mirror');
});

// 4. GRABACIÓN DE VIDEO
btnRecord.addEventListener('click', () => {
  if (!currentStream) return;
  
  recordedChunks = [];
  let options = { mimeType: 'video/webm;codecs=vp9' };
  
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'video/mp4' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: '' };
    }
  }

  try {
    mediaRecorder = new MediaRecorder(currentStream, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
    return;
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/mp4' });
    const now = new Date();
    recordedVideos.push({
      blob: blob,
      date: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + now.toLocaleDateString()
    });
    renderGallery();
  };

  mediaRecorder.start();
  btnRecord.style.display = 'none';
  btnStopRec.style.display = 'flex';
  startPrompter();
});

btnStopRec.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  btnStopRec.style.display = 'none';
  btnRecord.style.display = 'flex';
  stopPrompter();
});

// 5. GALERÍA Y MODAL COMPATIBLE CON IOS / ANDROID
function renderGallery() {
  const galleryGrid = document.getElementById('galleryGrid');
  const videoCount = document.getElementById('videoCount');
  
  if (!galleryGrid) return;
  
  galleryGrid.innerHTML = '';
  if (videoCount) videoCount.textContent = recordedVideos.length;

  if (recordedVideos.length === 0) {
    galleryGrid.innerHTML = '<p id="emptyGalleryMsg">No hay videos grabados aún.</p>';
    return;
  }

  recordedVideos.forEach((item, index) => {
    const videoBlobUrl = URL.createObjectURL(item.blob);

    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `
      <div class="thumb-wrapper" onclick="openVideoModal('${videoBlobUrl}')">
        <video src="${videoBlobUrl}#t=0.1" preload="metadata" playsinline webkit-playsinline class="thumb-img"></video>
        <div class="play-overlay">▶</div>
      </div>
      <div class="card-info">
        <small>${item.date}</small>
        <div class="card-actions">
          <button class="btn-download" onclick="downloadVideo('${videoBlobUrl}', 'grabacion_${index + 1}.mp4')">💾 Guardar</button>
          <button class="btn-delete" onclick="deleteVideo(${index})">🗑️ Borrar</button>
        </div>
      </div>
    `;
    galleryGrid.appendChild(card);
  });
}

window.openVideoModal = function(url) {
  if (videoModal && modalVideoPlayer) {
    modalVideoPlayer.src = url;
    videoModal.style.display = 'flex';
    
    const playPromise = modalVideoPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log("Autoplay prevenido por el navegador:", error);
      });
    }
  }
};

window.closeModal = function() {
  if (videoModal && modalVideoPlayer) {
    modalVideoPlayer.pause();
    modalVideoPlayer.removeAttribute('src');
    modalVideoPlayer.load();
    videoModal.style.display = 'none';
  }
};

window.downloadVideo = function(url, filename) {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
  }, 100);
};

window.deleteVideo = function(index) {
  recordedVideos.splice(index, 1);
  renderGallery();
};

// Eventos de inicialización
document.addEventListener('DOMContentLoaded', () => {
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', window.closeModal);
  }

  if (videoModal) {
    videoModal.addEventListener('click', (e) => {
      if (e.target === videoModal) {
        window.closeModal();
      }
    });
  }
  
  // Ajuste inicial del tamaño de letra
  if (fontSizeInput && prompterText) {
    prompterText.style.fontSize = `${fontSizeInput.value}px`;
  }
});
