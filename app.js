let challenges = [];
let currentChallenge = null;
let selectedFile = null;

// Limite seguro para o Apps Script. Base64 cresce ~33%, então 35 MB de arquivo
// vira ~47 MB de payload, abaixo do teto de ~50 MB.
const MAX_FILE_MB = 35;

const nomeInput = document.getElementById("nome");
const challengeText = document.getElementById("challengeText");
const drawBtn = document.getElementById("drawBtn");
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("file");
const cameraInput = document.getElementById("cameraInput");
const videoInput = document.getElementById("videoInput");
const takePhotoBtn = document.getElementById("takePhotoBtn");
const recordVideoBtn = document.getElementById("recordVideoBtn");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const selectedFileBox = document.getElementById("selectedFileBox");
const selectedFileName = document.getElementById("selectedFileName");
const sendBtn = document.getElementById("sendBtn");
const statusEl = document.getElementById("status");
const rankingList = document.getElementById("rankingList");
const refreshRankingBtn = document.getElementById("refreshRankingBtn");
const galleryGrid = document.getElementById("galleryGrid");
const refreshGalleryBtn = document.getElementById("refreshGalleryBtn");
const howBtn = document.getElementById("howBtn");
const modal = document.getElementById("modal");
const modalMedia = document.getElementById("modalMedia");
const modalInfo = document.getElementById("modalInfo");
const closeModalBtn = document.getElementById("closeModalBtn");
const uploadModal = document.getElementById("uploadModal");
const uploadProgressBar = document.getElementById("uploadProgressBar");
const uploadModalText = document.getElementById("uploadModalText");
const uploadModalPct = document.getElementById("uploadModalPct");
const confirmModal = document.getElementById("confirmModal");
const confirmPreview = document.getElementById("confirmPreview");
const confirmSendBtn = document.getElementById("confirmSendBtn");
const confirmRedoBtn = document.getElementById("confirmRedoBtn");

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

// ID único por aparelho/navegador, para separar pessoas com o mesmo nome.
function getDeviceId() {
  let id = localStorage.getItem("memorias_device_id");
  if (!id) {
    id = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("memorias_device_id", id);
  }
  return id;
}

function savePending(challenge) {
  localStorage.setItem("memorias_pending_challenge", JSON.stringify(challenge));
}

function clearPending() {
  localStorage.removeItem("memorias_pending_challenge");
}

function getPending() {
  try {
    return JSON.parse(localStorage.getItem("memorias_pending_challenge"));
  } catch {
    return null;
  }
}

// Descobre se o desafio pede vídeo (pelo texto). Senão, é foto.
function isVideoChallenge(challenge) {
  const text = String((challenge && challenge.desafio) || "").toLowerCase();
  return /\b(v[ií]deo|grav|film|boomerang)/.test(text);
}

function showChallenge(challenge, pending = false) {
  currentChallenge = challenge;
  challengeText.textContent = challenge.desafio;
  uploadArea.classList.remove("hidden");

  // Mostra só o botão de captura que combina com o desafio.
  const wantsVideo = isVideoChallenge(challenge);
  takePhotoBtn.classList.toggle("hidden", wantsVideo);
  recordVideoBtn.classList.toggle("hidden", !wantsVideo);

  if (pending) {
    drawBtn.disabled = true;
    drawBtn.textContent = "Envie para liberar novo desafio";
    setStatus(wantsVideo
      ? "Você já tem um desafio pendente. Grave o vídeo (ou escolha da galeria) para pontuar."
      : "Você já tem um desafio pendente. Tire a foto (ou escolha da galeria) para pontuar.");
  } else {
    drawBtn.disabled = true;
    drawBtn.textContent = "Desafio pendente";
    setStatus(wantsVideo
      ? "Este desafio é de vídeo. Grave agora ou escolha um vídeo da galeria."
      : "Este desafio é de foto. Tire a foto agora ou escolha uma da galeria.");
  }
}

async function apiGet(action) {
  const url = `${API_URL}?action=${action}&t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  return await res.json();
}

async function loadChallenges() {
  if (!API_URL || API_URL.includes("COLE_AQUI")) {
    setStatus("Configure a URL do Apps Script no arquivo config.js.", "error");
    return;
  }

  try {
    const data = await apiGet("desafios");
    challenges = data.desafios || [];

    if (!challenges.length) {
      setStatus("Nenhum desafio encontrado na planilha.", "error");
    }
  } catch {
    setStatus("Não foi possível carregar os desafios. Verifique a conexão e recarregue.", "error");
  }
}

async function loadRanking() {
  if (!API_URL || API_URL.includes("COLE_AQUI")) {
    rankingList.innerHTML = "<li>Configure o Apps Script primeiro.</li>";
    return;
  }

  try {
    const data = await apiGet("ranking");
    const ranking = data.ranking || [];

    if (!ranking.length) {
      rankingList.innerHTML = "<li>Ainda não há pontuação.</li>";
      return;
    }

    // Conta nomes repetidos para mostrar um código curto e diferenciar pessoas
    // distintas (celulares diferentes) que usaram o mesmo nome.
    const nameCounts = {};
    ranking.forEach(item => {
      const key = String(item.nome || "").trim().toLowerCase();
      nameCounts[key] = (nameCounts[key] || 0) + 1;
    });

    rankingList.innerHTML = ranking
      .slice(0, 10)
      .map(item => {
        const key = String(item.nome || "").trim().toLowerCase();
        const isDup = nameCounts[key] > 1 && item.tag;
        const suffix = isDup ? ` <span class="rank-tag">#${escapeHtml(item.tag)}</span>` : "";
        return `<li><strong>${escapeHtml(item.nome)}</strong>${suffix} — ${item.pontos} pontos (${item.envios} envio${item.envios == 1 ? "" : "s"})</li>`;
      })
      .join("");
  } catch {
    rankingList.innerHTML = "<li>Não foi possível carregar o ranking.</li>";
  }
}

function drawChallenge() {
  const nome = nomeInput.value.trim();

  if (!nome) {
    setStatus("Digite seu nome ou apelido antes de sortear.", "error");
    return;
  }

  if (!challenges.length) {
    setStatus("Carregando desafios. Tente novamente em alguns segundos.", "error");
    return;
  }

  const pending = getPending();
  if (pending) {
    showChallenge(pending, true);
    return;
  }

  let count = 0;
  const totalRolls = 26;
  challengeText.classList.add("rolling");

  const interval = setInterval(() => {
    const random = challenges[Math.floor(Math.random() * challenges.length)];
    challengeText.textContent = random.desafio;
    count++;

    if (count >= totalRolls) {
      clearInterval(interval);
      challengeText.classList.remove("rolling");

      const picked = challenges[Math.floor(Math.random() * challenges.length)];
      const selected = { ...picked, nome };
      savePending(selected);
      showChallenge(selected);
    }
  }, 85);
}

function setSelectedFile(file) {
  selectedFile = file || null;

  if (!selectedFile) {
    selectedFileBox.classList.add("hidden");
    selectedFileName.textContent = "";
    sendBtn.disabled = true;
    return;
  }

  const sizeMb = selectedFile.size / (1024 * 1024);
  if (sizeMb > MAX_FILE_MB) {
    selectedFile = null;
    selectedFileBox.classList.add("hidden");
    selectedFileName.textContent = "";
    sendBtn.disabled = true;
    setStatus(
      `Arquivo muito grande (${sizeMb.toFixed(1)} MB). O limite é ${MAX_FILE_MB} MB. ` +
      `Para vídeo, grave um trecho mais curto ou reduza a qualidade.`,
      "error"
    );
    return;
  }

  selectedFileBox.classList.remove("hidden");
  selectedFileName.textContent = selectedFile.name || "foto-da-camera.jpg";
  sendBtn.disabled = false;
  setStatus("Arquivo pronto. Clique em enviar para pontuar.");
}

// ---- Modal de confirmação (enviar ou refazer) ----
let confirmObjectUrl = null;
let confirmRedoSource = null;

function openConfirm(file, sourceInput, redoLabel) {
  if (confirmObjectUrl) URL.revokeObjectURL(confirmObjectUrl);
  confirmObjectUrl = URL.createObjectURL(file);
  confirmRedoSource = sourceInput;

  const isVideo = String(file.type || "").startsWith("video/");
  confirmPreview.innerHTML = isVideo
    ? `<video src="${confirmObjectUrl}" controls playsinline></video>`
    : `<img src="${confirmObjectUrl}" alt="Pré-visualização" />`;

  confirmRedoBtn.textContent = redoLabel;
  confirmModal.classList.remove("hidden");
}

function hideConfirm() {
  confirmModal.classList.add("hidden");
  confirmPreview.innerHTML = "";
  if (confirmObjectUrl) {
    URL.revokeObjectURL(confirmObjectUrl);
    confirmObjectUrl = null;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Modal de progresso do envio.
function showUploadModal() {
  setUploadProgress(0, "Preparando sua memória...");
  uploadModal.classList.remove("hidden");
}

function hideUploadModal() {
  uploadModal.classList.add("hidden");
}

function setUploadProgress(frac, text) {
  const pct = Math.round(Math.max(0, Math.min(1, frac)) * 100);
  uploadProgressBar.style.width = pct + "%";
  uploadModalPct.textContent = pct + "%";
  if (text) uploadModalText.textContent = text;
}

// Reduz a foto antes de enviar (mais rápido). Vídeos passam direto.
async function compressImage(file, maxDim = 1600, quality = 0.82) {
  if (!file || !String(file.type).startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file; // não compensou: envia o original

    const baseName = (file.name || "foto").replace(/\.\w+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch (err) {
    return file; // formatos não suportados (ex: HEIC): envia o original
  }
}

// Progresso simulado: o Apps Script não permite progresso real de upload
// (registrar ouvinte no xhr.upload exige preflight CORS, que ele não responde).
// A barra avança suavemente até ~90% e o envio a completa em 100% no fim.
function startFakeProgress(from, to, text) {
  let current = from;
  setUploadProgress(current, text);
  const id = setInterval(() => {
    current += (to - current) * 0.08;
    setUploadProgress(current);
  }, 400);
  return () => clearInterval(id);
}

async function sendFile() {
  const nome = nomeInput.value.trim();
  const pending = getPending();

  if (!nome) {
    setStatus("Digite seu nome ou apelido.", "error");
    return;
  }

  if (!pending) {
    setStatus("Sorteie um desafio primeiro.", "error");
    return;
  }

  if (!selectedFile) {
    setStatus("Tire uma foto ou escolha uma foto/vídeo para enviar.", "error");
    return;
  }

  try {
    sendBtn.disabled = true;
    sendBtn.textContent = "Enviando...";
    setStatus("");
    showUploadModal();

    setUploadProgress(0.05, "Otimizando arquivo...");
    const fileToSend = await compressImage(selectedFile);

    const isVideoUpload = String(fileToSend.type || "").startsWith("video/");

    setUploadProgress(0.1, "Enviando sua memória...");
    const base64 = await fileToBase64(fileToSend);

    const payload = {
      action: "upload",
      nome,
      desafio: pending.desafio,
      pontos: Number(pending.pontos || 0),
      filename: fileToSend.name || `foto_${Date.now()}.jpg`,
      mimeType: fileToSend.type || "image/jpeg",
      deviceId: getDeviceId(),
      fileBase64: base64
    };

    const stopProgress = startFakeProgress(0.1, 0.9, "Enviando sua memória...");
    let data;
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      data = await res.json();
    } finally {
      stopProgress();
    }

    if (!data.ok) {
      throw new Error(data.error || "Erro ao enviar.");
    }

    setUploadProgress(1, "Concluído!");
    hideUploadModal();
    clearPending();
    currentChallenge = null;
    selectedFile = null;
    fileInput.value = "";
    cameraInput.value = "";
    videoInput.value = "";
    selectedFileBox.classList.add("hidden");
    selectedFileName.textContent = "";
    uploadArea.classList.add("hidden");
    challengeText.textContent = "Desafio concluído! Pode sortear outro.";
    drawBtn.disabled = false;
    drawBtn.textContent = "Sortear novo desafio";
    setStatus(isVideoUpload
      ? "Vídeo enviado com sucesso! Ele pode levar 1–2 minutos para ficar disponível na galeria."
      : "Parabéns! Desafio concluído com sucesso.", "success");
    await loadRanking();
    await loadGallery();
  } catch (err) {
    hideUploadModal();
    setStatus("Erro ao enviar: " + err.message, "error");
    sendBtn.disabled = false;
  } finally {
    sendBtn.textContent = "Enviar e pontuar";
  }
}

async function loadGallery() {
  if (!API_URL || API_URL.includes("COLE_AQUI")) {
    galleryGrid.innerHTML = '<p class="empty">Configure o Apps Script primeiro.</p>';
    return;
  }

  try {
    galleryGrid.innerHTML = '<p class="empty">Carregando galeria...</p>';
    const data = await apiGet("galeria");
    const items = data.galeria || [];

    if (!items.length) {
      galleryGrid.innerHTML = '<p class="empty">Ainda não há fotos ou vídeos enviados.</p>';
      return;
    }

    galleryGrid.innerHTML = items.map((item, index) => galleryItemTemplate(item, index)).join("");

    document.querySelectorAll(".gallery-item").forEach(el => {
      el.addEventListener("click", () => {
        const index = Number(el.dataset.index);
        openMedia(items[index]);
      });
    });
  } catch (err) {
    galleryGrid.innerHTML = '<p class="empty">Não foi possível carregar a galeria.</p>';
  }
}

// Detecta vídeo pelo mime OU pela extensão do nome do arquivo (envios antigos
// têm mime vazio, mas o nome guarda a extensão).
function isVideoItem(item) {
  if (String(item.mimeType || "").startsWith("video/")) return true;
  const name = String(item.arquivoNome || item.fileName || "").toLowerCase();
  return /\.(mp4|mov|m4v|webm|avi|mkv|3gp|ogg|ogv|qt)$/.test(name);
}

function galleryItemTemplate(item, index) {
  const nome = escapeHtml(item.nome || "Convidado");
  const desafio = escapeHtml(item.desafio || "");
  const isVideo = isVideoItem(item);
  const id = driveIdOf(item);
  const thumb = getBestThumbnail(item);
  // Se a miniatura do drive.google.com falhar, tenta o googleusercontent e, se
  // ainda falhar (típico de vídeo sem poster), mostra o bloco de vídeo.
  const fallback = id ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1000` : "";

  const media = isVideo
    ? `<div class="video-placeholder">&#9658;</div>`
    : `<img class="gallery-thumb" src="${escapeHtml(thumb)}" alt="Foto enviada por ${nome}" loading="lazy" referrerpolicy="no-referrer"
         onerror="if(this.dataset.fb){this.outerHTML='<div class=video-placeholder>&#9658;</div>'}else{this.dataset.fb=1;this.src='${fallback}'}" />`;

  return `
    <article class="gallery-item" data-index="${index}">
      ${media}
      <div class="gallery-caption">
        <strong>${nome}</strong>
        <span>${desafio}</span>
      </div>
    </article>
  `;
}

// Endpoint thumbnail do Drive é o mais confiável para embutir imagens.
function driveThumb(fileId, size) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=${size}`;
}

// Versões antigas do Apps Script gravavam o link "/view" nas colunas de
// miniatura e não enviavam o fileId. Extraímos o ID de qualquer URL do Drive.
function extractDriveId(url) {
  if (!url) return "";
  const s = String(url);
  let m = s.match(/\/d\/([^/]+)/);
  if (m) return m[1];
  m = s.match(/[?&]id=([^&]+)/);
  if (m) return m[1];
  return "";
}

function driveIdOf(item) {
  return item.fileId
    || extractDriveId(item.thumbnailUrl)
    || extractDriveId(item.previewUrl)
    || extractDriveId(item.fileUrl)
    || extractDriveId(item.viewUrl);
}

function getBestThumbnail(item) {
  const id = driveIdOf(item);
  if (id) return driveThumb(id, "w1000");
  return item.thumbnailUrl || item.fileUrl || item.viewUrl || "";
}

function getBestImage(item) {
  const id = driveIdOf(item);
  if (id) return driveThumb(id, "w1600");
  return item.previewUrl || item.fileUrl || item.viewUrl || "";
}

function openMedia(item) {
  const isVideo = isVideoItem(item);
  const fallbackUrl = item.viewUrl || item.fileUrl || "";
  const id = driveIdOf(item);
  // O player do Drive (/preview) toca vídeo E mostra imagem de forma confiável.
  const embedUrl = id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview` : fallbackUrl;
  const playerHtml = `<iframe src="${escapeHtml(embedUrl)}" allow="autoplay" allowfullscreen></iframe>
       <p class="modal-info processing-note">Vídeos recém-enviados podem levar 1–2 minutos para ficar prontos. Se aparecer "processando", aguarde um pouco e tente de novo. <a href="${escapeHtml(fallbackUrl)}" target="_blank" rel="noopener" style="color:#f5d889">Abrir no Drive</a></p>`;

  if (isVideo) {
    modalMedia.innerHTML = playerHtml;
  } else {
    // Imagem; se falhar (pode ser vídeo não detectado), troca para o player.
    modalMedia.innerHTML = `<img src="${escapeHtml(getBestImage(item))}" alt="Memória enviada" referrerpolicy="no-referrer" />`;
    const img = modalMedia.querySelector("img");
    if (img) img.onerror = () => { modalMedia.innerHTML = playerHtml; };
  }

  modalInfo.innerHTML = `
    <strong>${escapeHtml(item.nome || "Convidado")}</strong><br>
    ${escapeHtml(item.desafio || "")}
  `;

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  modalMedia.innerHTML = "";
  modalInfo.innerHTML = "";
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.screen === screenId);
  });

  if (screenId === "screenGallery") {
    loadGallery();
  }

  if (screenId === "screenRanking") {
    loadRanking();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function init() {
  const pending = getPending();
  if (pending) {
    nomeInput.value = pending.nome || "";
    showChallenge(pending, true);
  }

  await loadChallenges();
  await loadRanking();
}

init().catch(err => setStatus("Erro ao iniciar: " + err.message, "error"));

drawBtn.addEventListener("click", drawChallenge);
sendBtn.addEventListener("click", sendFile);
refreshRankingBtn.addEventListener("click", loadRanking);
refreshGalleryBtn.addEventListener("click", loadGallery);
closeModalBtn.addEventListener("click", closeModal);
document.querySelector(".modal-backdrop").addEventListener("click", closeModal);
howBtn.addEventListener("click", () => showScreen("screenInfo"));

takePhotoBtn.addEventListener("click", () => cameraInput.click());
recordVideoBtn.addEventListener("click", () => videoInput.click());
chooseFileBtn.addEventListener("click", () => fileInput.click());

cameraInput.addEventListener("change", () => {
  const file = cameraInput.files && cameraInput.files[0];
  setSelectedFile(file);
  if (selectedFile) openConfirm(selectedFile, cameraInput, "Tirar outra foto");
});

videoInput.addEventListener("change", () => {
  const file = videoInput.files && videoInput.files[0];
  setSelectedFile(file);
  if (selectedFile) openConfirm(selectedFile, videoInput, "Gravar outro vídeo");
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  setSelectedFile(file);
  if (selectedFile) openConfirm(selectedFile, fileInput, "Escolher outro arquivo");
});

confirmSendBtn.addEventListener("click", () => {
  hideConfirm();
  sendFile();
});

confirmRedoBtn.addEventListener("click", () => {
  const source = confirmRedoSource;
  hideConfirm();
  if (source) source.click();
});

document.querySelector(".confirm-backdrop").addEventListener("click", hideConfirm);

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.screen));
});
