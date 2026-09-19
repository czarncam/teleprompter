// Estado global
let recordedVideos = []; 
let mediaRecorder = null;
let recordedChunks = [];
let currentStream = null;
let prompterInterval = null;
let isPrompterRunning = false;
let currentFacingMode = 'user';
let isWideAngle = false;
let db = null;

// Referencias DOM
let navHome, navEditor, navPrompter, navGallery;
let sectionHome, sectionEditor, sectionPrompter, sectionGallery;
let btnHomeEditor, btnHomePrompter, btnHomeGallery;
let textInput, btnGoToPrompter, prompterDisplay, prompterText, cameraPreview;
let speedInput, fontSizeInput, btnMirror;
let btnReset, btnPlay, btnRecord, btnStopRec, btnSwitchCam, btnZoom;
let videoModal, modalVideoPlayer, btnCloseModal;

// Inicialización de IndexedDB
function initDB() {
  try {
    const request = indexedDB.open('TeleprompterDB', 2);

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
      console.warn('IndexedDB no disponible, se usará memoria temporal:', e);
    };
  } catch (err) {
    console.warn('Error inicializando IndexedDB:', err);
  }
}

// Guardar Video (Compatible con iOS Safari / Android Chrome)
async function saveVideoToDB(blob, dateString) {
  const videoItem = {
    id: Date.now(),
    blob: blob,
    url: URL.createObjectURL(blob),
    date: dateString
  };

  // Guardar inmediatamente en memoria local para garantizar visibilidad en la interfaz
  recordedVideos.unshift(videoItem);
  renderGallery();

  // Intentar persistir en IndexedDB como ArrayBuffer (Evita cierres silenciosos en iOS Safari)
  if (db) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const transaction = db.transaction(['videos'], 'readwrite');
      const store = transaction.objectStore('videos');
      
      store.add({
        id: videoItem.id,
        buffer: arrayBuffer,
        type: blob.type,
        date: dateString
      });
    } catch (err) {
      console.warn("No se pudo guardar en IndexedDB permanentemente, el video queda disponible en esta sesión:", err);
    }
  }
}

function loadVideosFromDB() {
  if (!db) return;
  try {
    const transaction = db.transaction(['videos'], 'readonly');
    const store = transaction.objectStore('videos');
    const request = store.getAll();

    request.onsuccess = (e) => {
      const records = e.target.result || [];
      if (records.length > 0) {
        // Limpiar URLs previas
        recordedVideos.forEach(item => {
          if (item.url) URL.revokeObjectURL(item.url);
        });

        recordedVideos = records.map(rec => {
          const blob = rec.blob || new Blob([rec.buffer], { type: rec.type || 'video/mp4' });
          return {
            id: rec.id,
            blob: blob,
            url: URL.createObjectURL(blob),
            date: rec.date
          };
        }).reverse();

        renderGallery();
      }
    };
  } catch (err) {
    console.error("Error al cargar videos desde DB:", err);
  }
}

function deleteVideoFromDB(id) {
  recordedVideos = recordedVideos.filter(v => v.id !== id);
  renderGallery();

  if (db) {
    try {
      const transaction = db.transaction(['videos'], 'readwrite');
      const store = transaction.objectStore('videos');
      store.delete(id);
    } catch (err) {
      console.error("Error borrando de DB:", err);
    }
  }
}

// Navegación
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

// Cámara
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
    console.error("Error accediendo a cámara:", err);
    alert("Para poder grabar, autoriza los permisos de cámara y micrófono en tu navegador.");
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
}

// Prompter
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
  }, 25);
}

function stopPrompter() {
  isPrompterRunning = false;
  if (btnPlay) btnPlay.textContent = '▶ Leer';
  if (prompterInterval) {
    clearInterval(prompterInterval);
    prompterInterval = null;
  }
}

// Selector de tipo MIME compatible
function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';

  const types = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];

  for (let type of types) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

// Grabación
function startRecording() {
  if (!currentStream) {
    alert("Inicia la cámara antes de comenzar a grabar.");
    return;
  }

  recordedChunks = [];
  const mimeType = getSupportedMimeType();
  const options = mimeType ? { mimeType } : {};

  try {
    mediaRecorder = new MediaRecorder(currentStream, options);
  } catch (e) {
    try {
      mediaRecorder = new MediaRecorder(currentStream);
    } catch (err) {
      alert("Tu navegador no soporta el formato de grabación.");
      return;
    }
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    if (recordedChunks.length === 0) {
      alert("No se capturaron datos de video. Intenta de nuevo.");
      return;
    }

    const finalMime = mediaRecorder.mimeType || 'video/mp4';
    const blob = new Blob(recordedChunks, { type: finalMime });
    
    const now = new Date();
    const dateStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + now.toLocaleDateString();
    
    saveVideoToDB(blob, dateStr);
  };

  // Solicitar fragmentos continuos
  mediaRecorder.start(1000); 

  if (btnRecord) btnRecord.style.display = 'none';
  if (btnStopRec) btnStopRec.style.display = 'flex';
  
  startPrompter();
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (btnStopRec) btnStopRec.style.display = 'none';
  if (btnRecord) btnRecord.style.display = 'flex';
  
  stopPrompter();
}

// Galería y Modales
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
      <div class="thumb-wrapper" onclick="window.openVideoModal(${index})">
        <video src="${item.url}#t=0.1" preload="metadata" playsinline webkit-playsinline class="thumb-img"></video>
        <div class="play-overlay">▶</div>
      </div>
      <div class="card-info">
        <small>${item.date}</small>
        <div class="card-actions">
          <button class="btn-download" onclick="window.downloadVideo(${index})">💾 Guardar</button>
          <button class="btn-delete" onclick="window.deleteVideo(${item.id})">🗑️ Borrar</button>
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
    modalVideoPlayer.play().catch(() => {});
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

  const ext = item.blob.type.includes('webm') ? 'webm' : 'mp4';
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = item.url;
  a.download = `grabacion_${index + 1}.${ext}`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 100);
};

window.deleteVideo = function(id) {
  deleteVideoFromDB(id);
};

// Asignación de Eventos
document.addEventListener('DOMContentLoaded', () => {
  navHome = document.getElementById('navHome');
  navEditor = document.getElementById('navEditor');
  navPrompter = document.getElementById('navPrompter');
  navGallery = document.getElementById('navGallery');

  sectionHome = document.getElementById('section-home');
  sectionEditor = document.getElementById('section-editor');
  sectionPrompter = document.getElementById('section-prompter');
  sectionGallery = document.getElementById('section-gallery');

  btnHomeEditor = document.getElementById('btnHomeEditor');
  btnHomePrompter = document.getElementById('btnHomePrompter');
  btnHomeGallery = document.getElementById('btnHomeGallery');

  textInput = document.getElementById('textInput');
  btnGoToPrompter = document.getElementById('btnGoToPrompter');
  prompterDisplay = document.getElementById('prompter-display');
  prompterText = document.getElementById('prompter-text');
  cameraPreview = document.getElementById('cameraPreview');

  speedInput = document.getElementById('speed');
  fontSizeInput = document.getElementById('fontSize');
  btnMirror = document.getElementById('btnMirror');

  btnReset = document.getElementById('btnReset');
  btnPlay = document.getElementById('btnPlay');
  btnRecord = document.getElementById('btnRecord');
  btnStopRec = document.getElementById('btnStopRec');
  btnSwitchCam = document.getElementById('btnSwitchCam');
  btnZoom = document.getElementById('btnZoom');

  videoModal = document.getElementById('videoModal');
  modalVideoPlayer = document.getElementById('modalVideoPlayer');
  btnCloseModal = document.getElementById('btnCloseModal');

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
    prompterText.style.fontSize = `${fontSizeInput.value}px`;
  }

  if (btnMirror && prompterText) {
    btnMirror.addEventListener('click', () => {
      prompterText.classList.toggle('mirror');
    });
  }

  if (btnRecord) btnRecord.addEventListener('click', startRecording);
  if (btnStopRec) btnStopRec.style.display = 'none';
  if (btnStopRec) btnStopRec.addEventListener('click', stopRecording);

  if (btnCloseModal) btnCloseModal.addEventListener('click', window.closeModal);
  if (videoModal) {
    videoModal.addEventListener('click', (e) => {
      if (e.target === videoModal) window.closeModal();
    });
  }

  initDB();
});
