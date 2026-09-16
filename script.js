// Estado global de la aplicación
let recordedVideos = []; 
let mediaRecorder = null;
let recordedChunks = [];
let currentStream = null;
let prompterInterval = null;
let isPrompterRunning = false;
let currentFacingMode = 'user';
let isWideAngle = false;
let db = null;

// Elementos del DOM
const navHome = document.getElementById('navHome');
const navEditor = document.getElementById('navEditor');
const navPrompter = document.getElementById('navPrompter');
const navGallery = document.getElementById('navGallery');

const sectionHome = document.getElementById('section-home');
const sectionEditor = document.getElementById('section-editor');
const sectionPrompter = document.getElementById('section-prompter');
const sectionGallery = document.getElementById('section-gallery');

const btnHomeEditor = document.getElementById('btnHomeEditor');
const btnHomePrompter = document.getElementById('btnHomePrompter');
const btnHomeGallery = document.getElementById('btnHomeGallery');

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
const btnZoom = document.getElementById('btnZoom');

const videoModal = document.getElementById('videoModal');
const modalVideoPlayer = document.getElementById('modalVideoPlayer');
const btnCloseModal = document.getElementById('btnCloseModal');

// 0. INICIALIZACIÓN DE INDEXEDDB
function initDB() {
  const request = indexedDB.open('TeleprompterDB', 1);

  request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('videos')) {
      db.createObjectStore('videos', { keyPath: 'id', autoIncrement: true });
    }
  };

  request.onsuccess = (e) => {
    db = e.target.result;
    loadVideosFromDB();
  };

  request.onerror = (e) => {
    console.error('Error abriendo IndexedDB:', e);
  };
}

function saveVideoToDB(blob, dateString) {
  if (!db) return;
  const transaction = db.transaction(['videos'], 'readwrite');
  const store = transaction.objectStore('videos');
  const videoRecord = { blob: blob, date: dateString };
  
  const request = store.add(videoRecord);
  request.onsuccess = () => {
    loadVideosFromDB();
  };
}

function loadVideosFromDB() {
  if (!db) return;
  const transaction = db.transaction(['videos'], 'readonly');
  const store = transaction.objectStore('videos');
  const request = store.getAll();

  request.onsuccess = (e) => {
    recordedVideos.forEach(item => {
      if (item.url) URL.revokeObjectURL(item.url);
    });

    const records = e.target.result || [];
    recordedVideos = records.map(rec => ({
      id: rec.id,
      blob: rec.blob,
      url: URL.createObjectURL(rec.blob),
      date: rec.date
    }));

    renderGallery();
  };
}

function deleteVideoFromDB(id) {
  if (!db) return;
  const transaction = db.transaction(['videos'], 'readwrite');
  const store = transaction.objectStore('videos');
  store.delete(id);
  
  transaction.oncomplete = () => {
    loadVideosFromDB();
  };
}

// 1. NAVEGACIÓN ENTRE SECCIONES
function showSection(sectionToShow, activeBtn) {
  [sectionHome, sectionEditor, sectionPrompter, sectionGallery].forEach(sec => {
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

// Eventos Navegación
if (navHome) navHome.addEventListener('click', () => showSection(sectionHome, null));
if (navEditor) navEditor.addEventListener('click', () => showSection(sectionEditor, navEditor));
if (navPrompter) navPrompter.addEventListener('click', () => showSection(sectionPrompter, navPrompter));
if (navGallery) navGallery.addEventListener('click', () => showSection(sectionGallery, navGallery));

if (btnHomeEditor) btnHomeEditor.addEventListener('click', () => showSection(sectionEditor, navEditor));
if (btnHomePrompter) btnHomePrompter.addEventListener('click', () => {
  if (prompterText) prompterText.textContent = textInput.value || 'Escribe tu guion en el editor...';
  showSection(sectionPrompter, navPrompter);
});
if (btnHomeGallery) btnHomeGallery.addEventListener('click', () => showSection(sectionGallery, navGallery));

if (btnGoToPrompter) {
  btnGoToPrompter.addEventListener('click', () => {
    if (prompterText) prompterText.textContent = textInput.value || 'Escribe tu guion en el editor...';
    showSection(sectionPrompter, navPrompter);
  });
}

// 2. CONTROL DE CÁMARA
async function startCamera() {
  stopCamera();
  
  const constraints = {
    video: {
      facingMode: currentFacingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: true
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (cameraPreview) cameraPreview.srcObject = currentStream;

    const videoTrack = currentStream.getVideoTracks()[0];
    if (videoTrack && videoTrack.getCapabilities) {
      const capabilities = videoTrack.getCapabilities();
      if (capabilities.zoom) {
        const targetZoom = isWideAngle ? capabilities.zoom.min : 1;
        videoTrack.applyConstraints({
          advanced: [{ zoom: targetZoom }]
        }).catch(() => {});
      }
    }
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

if (btnSwitchCam) {
  btnSwitchCam.addEventListener('click', () => {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    startCamera();
  });
}

if (btnZoom) {
  btnZoom.addEventListener('click', () => {
    isWideAngle = !isWideAngle;
    btnZoom.textContent = isWideAngle ? "🔍 1x" : "🔍 0.5x";
    startCamera();
  });
}

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
  if (btnPlay) btnPlay.textContent = '⏸ Pausa';

  const speed = parseFloat(speedInput.value) || 1;
  prompterInterval = setInterval(() => {
    if (prompterDisplay) {
      prompterDisplay.scrollTop += speed;
    }
  }, 30);
}

function stopPrompter() {
  isPrompterRunning = false;
  if (btnPlay) btnPlay.textContent = '▶ Leer';
  if (prompterInterval) {
    clearInterval(prompterInterval);
    prompterInterval = null;
  }
}

if (btnPlay) btnPlay.addEventListener('click', togglePrompter);
if (btnReset) {
  btnReset.addEventListener('click', () => {
    stopPrompter();
    if (prompterDisplay) prompterDisplay.scrollTop = 0;
  });
}
if (fontSizeInput && prompterText) {
  fontSizeInput.addEventListener('input', (e) => {
    prompterText.style.fontSize = `${e.target.value}px`;
  });
}
if (btnMirror && prompterText) {
  btnMirror.addEventListener('click', () => {
    prompterText.classList.toggle('mirror');
  });
}

// 4. GRABACIÓN DE VIDEO UNIFICADA (iOS y Android)
function getSupportedMimeType() {
  const types = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  for (let type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

if (btnRecord) {
  btnRecord.addEventListener('click', () => {
    if (!currentStream) return;
    
    recordedChunks = [];
    const mimeType = getSupportedMimeType();

    try {
      mediaRecorder = new MediaRecorder(currentStream, mimeType ? { mimeType } : undefined);
    } catch (e) {
      mediaRecorder = new MediaRecorder(currentStream);
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      if (recordedChunks.length === 0) return;
      const finalMime = mediaRecorder.mimeType || 'video/mp4';
      const blob = new Blob(recordedChunks, { type: finalMime });
      const now = new Date();
      const dateStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + now.toLocaleDateString();
      
      saveVideoToDB(blob, dateStr);
    };

    mediaRecorder.start(100); 
    btnRecord.style.display = 'none';
    if (btnStopRec) btnStopRec.style.display = 'flex';
    startPrompter();
  });
}

if (btnStopRec) {
  btnStopRec.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    btnStopRec.style.display = 'none';
    if (btnRecord) btnRecord.style.display = 'flex';
    stopPrompter();
  });
}

// 5. GALERÍA Y MODAL
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
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `
      <div class="thumb-wrapper" onclick="openVideoModal(${index})">
        <video src="${item.url}#t=0.1" preload="metadata" playsinline webkit-playsinline class="thumb-img"></video>
        <div class="play-overlay">▶</div>
      </div>
      <div class="card-info">
        <small>${item.date}</small>
        <div class="card-actions">
          <button class="btn-download" onclick="downloadVideo(${index})">💾 Guardar</button>
          <button class="btn-delete" onclick="deleteVideo(${item.id})">🗑️ Borrar</button>
        </div>
      </div>
    `;
    galleryGrid.appendChild(card);
  });
}

window.openVideoModal = function(index) {
  const item = recordedVideos[index];
  if (!item) return;

  if (videoModal && modalVideoPlayer) {
    modalVideoPlayer.src = item.url;
    videoModal.style.display = 'flex';
    
    modalVideoPlayer.load();
    const playPromise = modalVideoPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
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

window.downloadVideo = function(index) {
  const item = recordedVideos[index];
  if (!item) return;

  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = item.url;
  a.download = `grabacion_${index + 1}.mp4`;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
  }, 100);
};

window.deleteVideo = function(id) {
  deleteVideoFromDB(id);
};

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  initDB();

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
  
  if (fontSizeInput && prompterText) {
    prompterText.style.fontSize = `${fontSizeInput.value}px`;
  }
});
