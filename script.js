const camera = document.getElementById('camera');
const canvas = document.getElementById('photoCanvas');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const cameraStatus = document.getElementById('cameraStatus');
const captureProgress = document.getElementById('captureProgress');
const cameraNote = document.getElementById('cameraNote');
const countdown = document.getElementById('countdown');
const flash = document.getElementById('flash');
const startCameraBtn = document.getElementById('startCameraBtn');
const captureBtn = document.getElementById('captureBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const retakeBtn = document.getElementById('retakeBtn');
const resultSection = document.getElementById('resultSection');
const resultImage = document.getElementById('resultImage');
const downloadBtn = document.getElementById('downloadBtn');
const newPhotoBtn = document.getElementById('newPhotoBtn');
const timerSelect = document.getElementById('timerSelect');
const photoCountSelect = document.getElementById('photoCountSelect');
const mirrorToggle = document.getElementById('mirrorToggle');
const templateTitleInput = document.getElementById('templateTitleInput');
const templateDateInput = document.getElementById('templateDateInput');
const templateBackgroundInput = document.getElementById('templateBackgroundInput');
const templateForegroundInput = document.getElementById('templateForegroundInput');
const modeButtons = document.querySelectorAll('[data-mode]');
const templateButtons = document.querySelectorAll('[data-template]');
const partnerPhotoInput = document.getElementById('partnerPhotoInput');
const uploadStatus = document.getElementById('uploadStatus');
const removePartnerBtn = document.getElementById('removePartnerBtn');
const remoteCamera = document.getElementById('remoteCamera');
const roomPanel = document.getElementById('roomPanel');
const roomStatus = document.getElementById('roomStatus');
const roomLiveDot = document.getElementById('roomLiveDot');
const createRoomBtn = document.getElementById('createRoomBtn');
const copyRoomBtn = document.getElementById('copyRoomBtn');
const roomCodeWrap = document.getElementById('roomCodeWrap');
const roomCode = document.getElementById('roomCode');
const roomCodeInput = document.getElementById('roomCodeInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const muteAudioBtn = document.getElementById('muteAudioBtn');

let stream = null;
let facingMode = 'user';
let selectedTemplate = 'classic';
let selectedPhotoCount = Number(photoCountSelect.value);
let selectedMode = 'single';
let capturedPhotos = [];
let partnerPhoto = null;
let remotePhotos = [];
let peer = null;
let dataConnection = null;
let activeRoomCode = '';
let captureInProgress = false;

function getRequiredPhotoCount() {
    return selectedPhotoCount;
}

function getTemplateLabel() {
    return selectedTemplate === 'love' ? 'DENGAN CINTA' : selectedTemplate === 'film' ? 'PHOTOBOOTH / 2026' : selectedTemplate === 'pastel' ? 'GOOD VIBES' : selectedTemplate === 'floral' ? 'HAPPY DAY' : selectedTemplate === 'retro' ? 'MEMORIES' : selectedTemplate === 'collage' ? 'OUR DAY' : selectedTemplate === 'analog' ? 'MEMORIES ON AIR' : 'SENYUM HARI INI';
}

function getSessionPhotos() {
    return partnerPhoto ? [partnerPhoto, ...capturedPhotos] : [...capturedPhotos];
}

function updateCaptureProgress() {
    const total = getRequiredPhotoCount();
    const current = selectedMode === 'dual'
        ? Math.min(Math.min(capturedPhotos.length, remotePhotos.length), total)
        : Math.min(getSessionPhotos().length, total);
    captureProgress.textContent = `Foto ${current}/${total}`;
    captureBtn.disabled = !stream || current >= total || (selectedMode === 'dual' && !dataConnection);
}

function makeRoomCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function setRoomStatus(message, connected = false) {
    roomStatus.textContent = message;
    roomLiveDot.classList.toggle('connected', connected);
}

function showRemoteStream(call) {
    call.on('stream', remoteStream => {
        remoteCamera.srcObject = remoteStream;
        remoteCamera.classList.remove('hidden');
        setRoomStatus('Teman sudah terhubung. Kalian bisa saling melihat.', true);
    });
}

function setupDataConnection(connection) {
    dataConnection = connection;
    connection.on('open', () => {
        setRoomStatus('Terhubung. Temanmu siap foto bersama.', true);
        updateCaptureProgress();
    });
    connection.on('data', async message => {
        if (message.type === 'capture') {
            if (!captureInProgress && capturedPhotos.length === message.index) {
                await capturePhoto(false, message.index, message.seconds);
            }
            return;
        }
        if (message.type === 'photo') {
            remotePhotos[message.index] = message.photo;
            updateCaptureProgress();
            await renderDualResultIfReady();
        }
    });
    connection.on('close', () => {
        dataConnection = null;
        setRoomStatus('Koneksi teman terputus.', false);
        updateCaptureProgress();
    });
}

function openPeerConnection(peerInstance, roomId, isHost) {
    peer = peerInstance;
    activeRoomCode = roomId;
    peer.on('error', error => {
        if (error.type === 'unavailable-id' && isHost) {
            openPeerConnection(new Peer(makeRoomCode()), activeRoomCode, true);
            return;
        }
        setRoomStatus('Koneksi gagal. Periksa kode dan coba lagi.', false);
    });
    peer.on('call', call => {
        call.answer(stream);
        showRemoteStream(call);
    });
    peer.on('connection', setupDataConnection);
    peer.on('open', id => {
        activeRoomCode = id;
        roomCode.textContent = id;
        roomCodeWrap.classList.remove('hidden');
        if (isHost) setRoomStatus('Kode siap dibagikan. Menunggu teman...', false);
    });
}

async function ensureCameraForRoom() {
    if (!stream) await startCamera();
    return Boolean(stream);
}

async function createRoom() {
    if (!(await ensureCameraForRoom())) return;
    if (!window.Peer) {
        setRoomStatus('Layanan koneksi belum termuat. Muat ulang halaman.', false);
        return;
    }
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;
    const code = makeRoomCode();
    openPeerConnection(new Peer(code), code, true);
}

async function joinRoom() {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (code.length !== 6) {
        setRoomStatus('Masukkan kode 6 karakter dari teman.', false);
        return;
    }
    if (!(await ensureCameraForRoom())) return;
    if (!window.Peer) {
        setRoomStatus('Layanan koneksi belum termuat. Muat ulang halaman.', false);
        return;
    }
    joinRoomBtn.disabled = true;
    createRoomBtn.disabled = true;
    setRoomStatus('Menghubungkan ke ruang teman...', false);
    peer = new Peer();
    peer.on('open', id => {
        const call = peer.call(code, stream);
        showRemoteStream(call);
        setupDataConnection(peer.connect(code));
    });
    peer.on('error', () => setRoomStatus('Ruang tidak ditemukan atau sudah ditutup.', false));
}

function setCameraMessage(message, status = 'SIAP') {
    cameraStatus.textContent = status;
    cameraNote.textContent = message;
}

async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
        setCameraMessage('Browser ini tidak mendukung akses kamera. Gunakan browser modern.', 'TIDAK TERSEDIA');
        return;
    }

    startCameraBtn.disabled = true;
    setCameraMessage('Izinkan akses kamera pada dialog browser...', 'MEMINTA IZIN');

    try {
        if (stream) stream.getTracks().forEach(track => track.stop());
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        camera.srcObject = stream;
        cameraPlaceholder.classList.add('hidden');
        captureBtn.disabled = false;
        switchCameraBtn.disabled = false;
        setCameraMessage('Kamera aktif. Siap menangkap momen.', 'AKTIF');
        muteAudioBtn.disabled = false;
        updateCaptureProgress();
    } catch (error) {
        startCameraBtn.disabled = false;
        muteAudioBtn.disabled = true;
        setCameraMessage('Akses kamera atau mikrofon ditolak. Izinkan keduanya untuk koordinasi suara.', 'GAGAL');
    }
}

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function runCountdown(seconds = Number(timerSelect.value)) {
    for (let remaining = seconds; remaining > 0; remaining -= 1) {
        countdown.textContent = remaining;
        await wait(1000);
    }
    countdown.textContent = '';
}

function drawPhoto(source, targetCanvas) {
    const width = source.videoWidth || source.naturalWidth;
    const height = source.videoHeight || source.naturalHeight;
    const size = Math.min(width, height);
    const sourceX = (width - size) / 2;
    const sourceY = (height - size) / 2;
    targetCanvas.width = size;
    targetCanvas.height = size;
    const context = targetCanvas.getContext('2d');
    context.save();
    if (mirrorToggle.checked) {
        context.translate(size, 0);
        context.scale(-1, 1);
    }
    context.drawImage(source, sourceX, sourceY, size, size, 0, 0, size, size);
    context.restore();
    return targetCanvas.toDataURL('image/jpeg', 0.92);
}

function addText(context, text, x, y, size, color, align = 'center') {
    context.fillStyle = color;
    context.font = `700 ${size}px DM Sans, sans-serif`;
    context.textAlign = align;
    context.fillText(text, x, y);
}

function drawTemplateDecoration(context, template, width, height, foreground) {
    context.save();
    context.fillStyle = foreground;
    context.strokeStyle = foreground;
    context.globalAlpha = 0.72;
    if (template === 'pastel') {
        context.font = '700 30px DM Sans, sans-serif';
        context.fillText('✦', 25, 42);
        context.fillText('✦', width - 50, height - 35);
        context.font = '700 15px DM Sans, sans-serif';
        context.fillText('GOOD VIBES', 28, height - 58);
    }
    if (template === 'floral') {
        context.font = '30px serif';
        context.fillText('✿', 23, 42);
        context.fillText('❀', width - 52, height - 35);
        context.font = '700 15px DM Sans, sans-serif';
        context.fillText('HAPPY DAY', width / 2, height - 58);
    }
    if (template === 'retro') {
        context.lineWidth = 3;
        context.strokeRect(22, 22, width - 44, height - 44);
        context.font = '700 15px DM Sans, sans-serif';
        context.fillText('MEMORIES', width / 2, height - 58);
    }
    if (template === 'collage') {
        context.font = '700 30px DM Sans, sans-serif';
        context.fillText('♥', 25, 42);
        context.fillText('★', width - 54, 42);
        context.font = '700 15px DM Sans, sans-serif';
        context.fillText('OUR DAY', width / 2, height - 58);
    }
    if (template === 'analog') {
        context.globalAlpha = 0.18;
        context.fillStyle = '#d7d3b5';
        for (let lineY = 0; lineY < height; lineY += 12) {
            context.fillRect(0, lineY, width, 2);
        }
        context.globalAlpha = 0.7;
        context.strokeStyle = '#b49a62';
        context.lineWidth = 8;
        context.strokeRect(22, 22, width - 44, height - 44);
        context.font = '700 18px DM Sans, sans-serif';
        context.textAlign = 'left';
        context.fillText('TV ANALOG', 36, 34);
        context.textAlign = 'right';
        context.fillText('CH 04', width - 36, 34);
    }
    context.restore();
}

function composePhotos(photoDataList) {
    return Promise.all(photoDataList.map(photoData => new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.src = photoData;
    }))).then(images => new Promise(resolve => renderTemplate(images, resolve)));
}

function combinePair(localPhoto, remotePhoto) {
    return Promise.all([localPhoto, remotePhoto].map(photoData => new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.src = photoData;
    }))).then(images => {
        const pairCanvas = document.createElement('canvas');
        const width = 1200;
        const height = 780;
        pairCanvas.width = width;
        pairCanvas.height = height;
        const context = pairCanvas.getContext('2d');
        context.fillStyle = '#f4f0e7';
        context.fillRect(0, 0, width, height);
        const targetWidth = 760;
        images.forEach((image, index) => {
            const x = index === 0 ? -20 : width - targetWidth + 20;
            const ratio = Math.max(targetWidth / image.width, height / image.height);
            const drawWidth = image.width * ratio;
            const drawHeight = image.height * ratio;
            context.save();
            context.beginPath();
            if (index === 0) {
                context.rect(0, 0, width * 0.64, height);
            } else {
                context.rect(width * 0.36, 0, width * 0.64, height);
            }
            context.clip();
            context.drawImage(image, x + (targetWidth - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
            context.restore();
        });
        const blend = context.createLinearGradient(width * 0.37, 0, width * 0.63, 0);
        blend.addColorStop(0, 'rgba(244, 240, 231, 0)');
        blend.addColorStop(0.5, 'rgba(244, 240, 231, 0.16)');
        blend.addColorStop(1, 'rgba(244, 240, 231, 0)');
        context.fillStyle = blend;
        context.fillRect(width * 0.34, 0, width * 0.32, height);
        return pairCanvas.toDataURL('image/jpeg', 0.92);
    });
}

async function renderDualResultIfReady() {
    const pairCount = Math.min(capturedPhotos.length, remotePhotos.length);
    if (pairCount < getRequiredPhotoCount()) return;
    const pairPhotos = [];
    for (let index = 0; index < getRequiredPhotoCount(); index += 1) {
        if (!capturedPhotos[index] || !remotePhotos[index]) return;
        pairPhotos.push(await combinePair(capturedPhotos[index], remotePhotos[index]));
    }
    resultImage.src = await composePhotos(pairPhotos);
    resultSection.classList.remove('hidden');
    setCameraMessage('Foto berdua selesai. Hasil siap diunduh.', 'SELESAI');
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTemplate(images, resolve) {
    const width = ['film', 'pastel', 'floral', 'retro', 'analog'].includes(selectedTemplate) ? 720 : 900;
    const hasPair = images.length > 1;
    const slotGap = ['film', 'retro'].includes(selectedTemplate) ? 18 : 28;
    const title = templateTitleInput.value.trim();
    const date = templateDateInput.value.trim();
    const gridTop = title || date ? 210 : 48;
    const footerSpace = ['film', 'pastel', 'floral', 'retro', 'analog'].includes(selectedTemplate) ? 150 : 190;
    const photoSize = Math.round(width * 0.84);
    const photoX = Math.round((width - photoSize) / 2);
    const height = gridTop + (images.length * photoSize) + ((images.length - 1) * slotGap) + footerSpace;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const background = templateBackgroundInput.value;
    const foreground = templateForegroundInput.value;
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    if (title || date) {
        context.fillStyle = foreground;
        context.textAlign = 'center';
        context.font = 'italic 76px "Playfair Display", serif';
        if (title) context.fillText(title, width / 2, 92);
        context.font = '500 20px DM Sans, sans-serif';
        if (date) context.fillText(date, width / 2, 158);
    }
    images.forEach((item, index) => {
        const x = photoX;
        const y = gridTop + index * (photoSize + slotGap);
        context.save();
        context.beginPath();
        context.rect(x, y, photoSize, photoSize);
        context.clip();
        const ratio = Math.max(photoSize / item.width, photoSize / item.height);
        const drawWidth = item.width * ratio;
        const drawHeight = item.height * ratio;
        context.drawImage(item, x + (photoSize - drawWidth) / 2, y + (photoSize - drawHeight) / 2, drawWidth, drawHeight);
        context.restore();
        if (index < images.length - 1) {
            const gapColor = {
                polaroid: '#d8eaf0', pastel: '#fff1f3', floral: '#fff8ed', retro: '#efe0c8', collage: '#fffaf2'
            }[selectedTemplate] || '#0b0b0b';
            context.fillStyle = gapColor;
            context.fillRect(x, y + photoSize, photoSize, slotGap);
        }
    });
    const label = hasPair ? 'KITA BERDUA' : getTemplateLabel();
    if (!title && !date) addText(context, label, width / 2, height - 58, 24, foreground);
    if (selectedTemplate === 'polaroid') addText(context, 'PHOTOBOOTH', width / 2, height - 20, 12, '#8b877e');
        drawTemplateDecoration(context, selectedTemplate, width, height, foreground);
    resolve(canvas.toDataURL('image/png'));
}

async function renderResultIfReady() {
    if (selectedMode === 'dual') {
        await renderDualResultIfReady();
    } else if (getSessionPhotos().length >= getRequiredPhotoCount()) {
        resultImage.src = await composePhotos(getSessionPhotos());
    }
}

async function capturePhoto(requestRemote = true, requestedIndex = capturedPhotos.length, countdownSeconds = Number(timerSelect.value)) {
    if (!stream || captureInProgress || (!requestRemote && capturedPhotos.length !== requestedIndex)) return;
    captureInProgress = true;
    captureBtn.disabled = true;
    setCameraMessage('Tahan pose sebentar...', 'MENGAMBIL');
    if (selectedMode === 'dual' && requestRemote && dataConnection?.open) {
        dataConnection.send({ type: 'capture', index: requestedIndex, seconds: countdownSeconds });
    }
    await runCountdown(countdownSeconds);
    flash.classList.remove('active');
    void flash.offsetWidth;
    flash.classList.add('active');
    const localPhoto = drawPhoto(camera, canvas);
    capturedPhotos.push(localPhoto);
    if (selectedMode === 'dual' && dataConnection?.open) {
        dataConnection.send({ type: 'photo', index: capturedPhotos.length - 1, photo: localPhoto });
    }
    const photos = selectedMode === 'dual' ? capturedPhotos : getSessionPhotos();
    updateCaptureProgress();
    retakeBtn.disabled = false;
    if (selectedMode === 'dual') {
        await renderDualResultIfReady();
        if (Math.min(capturedPhotos.length, remotePhotos.length) < getRequiredPhotoCount()) {
            setCameraMessage(`Foto kamu tersimpan. Tunggu foto teman ${remotePhotos.length + 1}/${getRequiredPhotoCount()}.`, 'TERKIRIM');
        }
    } else if (photos.length >= getRequiredPhotoCount()) {
        resultImage.src = await composePhotos(photos);
        resultSection.classList.remove('hidden');
        setCameraMessage('Semua slot terisi. Foto siap diunduh.', 'SELESAI');
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        setCameraMessage(`Foto tersimpan. Lanjutkan ke foto ${photos.length + 1}/${getRequiredPhotoCount()}.`, 'LANJUT');
    }
    captureInProgress = false;
    updateCaptureProgress();
}

function resetPhoto() {
    capturedPhotos = [];
    remotePhotos = [];
    resultImage.removeAttribute('src');
    resultSection.classList.add('hidden');
    setCameraMessage('Kamera aktif. Siap menangkap momen.', 'AKTIF');
    updateCaptureProgress();
}

startCameraBtn.addEventListener('click', startCamera);
captureBtn.addEventListener('click', capturePhoto);
retakeBtn.addEventListener('click', resetPhoto);
newPhotoBtn.addEventListener('click', resetPhoto);
photoCountSelect.addEventListener('change', () => {
    selectedPhotoCount = Number(photoCountSelect.value);
    resetPhoto();
    setCameraMessage(`Jumlah foto diubah menjadi ${selectedPhotoCount}. Siap mengambil ulang.`, 'SIAP');
});
switchCameraBtn.addEventListener('click', () => {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    startCamera();
});
mirrorToggle.addEventListener('change', () => {
    camera.style.transform = mirrorToggle.checked ? 'scaleX(-1)' : 'none';
});
downloadBtn.addEventListener('click', () => {
    if (!resultImage.src) return;
    const link = document.createElement('a');
    link.href = resultImage.src;
    link.download = `photobooth-${Date.now()}.png`;
    link.click();
});

templateButtons.forEach(button => button.addEventListener('click', async () => {
    templateButtons.forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    selectedTemplate = button.dataset.template;
    updateCaptureProgress();
    await renderResultIfReady();
}));

[templateTitleInput, templateDateInput, templateBackgroundInput, templateForegroundInput]
    .forEach(input => input.addEventListener('input', renderResultIfReady));

modeButtons.forEach(button => button.addEventListener('click', () => {
    modeButtons.forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    selectedMode = button.dataset.mode;
    document.body.classList.toggle('dual-mode', selectedMode === 'dual');
    roomPanel.classList.toggle('hidden', selectedMode !== 'dual');
    if (selectedMode === 'single') {
        remoteCamera.classList.add('hidden');
        setRoomStatus('Buat ruang atau masukkan kode teman. Satu klik capture untuk kalian berdua.', false);
    }
    setCameraMessage(selectedMode === 'dual' ? 'Mode dua perangkat aktif. Ambil foto kamu, lalu gabungkan foto pasangan.' : 'Kamera aktif. Siap menangkap momen.', 'AKTIF');
    updateCaptureProgress();
}));

createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);
roomCodeInput.addEventListener('input', event => {
    event.target.value = event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase();
});
copyRoomBtn.addEventListener('click', async () => {
    await navigator.clipboard?.writeText(activeRoomCode);
    copyRoomBtn.textContent = 'Tersalin';
    setTimeout(() => { copyRoomBtn.textContent = 'Salin'; }, 1400);
});

muteAudioBtn.addEventListener('click', () => {
    const audioTracks = stream?.getAudioTracks() || [];
    if (!audioTracks.length) return;
    const enabled = !audioTracks[0].enabled;
    audioTracks.forEach(track => { track.enabled = enabled; });
    muteAudioBtn.textContent = enabled ? 'Matikan Suara' : 'Nyalakan Suara';
    muteAudioBtn.classList.toggle('audio-muted', !enabled);
});

partnerPhotoInput.addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        partnerPhoto = reader.result;
        uploadStatus.textContent = `${file.name} siap digabungkan`;
        removePartnerBtn.disabled = false;
        updateCaptureProgress();
        if (getSessionPhotos().length >= getRequiredPhotoCount()) resultImage.src = await composePhotos(getSessionPhotos());
    };
    reader.readAsDataURL(file);
});

removePartnerBtn.addEventListener('click', () => {
    partnerPhoto = null;
    partnerPhotoInput.value = '';
    uploadStatus.textContent = 'Belum ada foto pasangan';
    removePartnerBtn.disabled = true;
    resultSection.classList.add('hidden');
    updateCaptureProgress();
    setCameraMessage('Foto pasangan dihapus. Kamu bisa mengambil foto sendiri.', 'AKTIF');
});

updateCaptureProgress();