/*
MEMÓRIAS — Google Apps Script corrigido com galeria

IMPORTANTE:
Depois de alterar este código, publique uma nova versão:
Implantar > Gerenciar implantações > Editar > Nova versão > Implantar
*/

const DRIVE_FOLDER_ID = "1F2bsdJ4caHMs_R6t3_Rr5o_Iv1vTY4g0";

function doGet(e) {
  const action = e.parameter.action;

  if (action === "desafios") {
    return jsonResponse({ desafios: getDesafios() });
  }

  if (action === "ranking") {
    return jsonResponse({ ranking: getRanking() });
  }

  if (action === "galeria") {
    return jsonResponse({ galeria: getGaleria() });
  }

  return jsonResponse({ ok: false, error: "Ação inválida" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action !== "upload") {
      return jsonResponse({ ok: false, error: "Ação inválida" });
    }

    if (!data.nome || !data.desafio || !data.fileBase64) {
      return jsonResponse({ ok: false, error: "Dados incompletos" });
    }

    // Evita que envios simultâneos corrompam o ranking ao gravar a linha.
    lock.waitLock(30000);

    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const bytes = Utilities.base64Decode(data.fileBase64);
    const blob = Utilities.newBlob(bytes, data.mimeType, data.filename);

    const safeName = `${new Date().toISOString()}_${data.nome}_${data.filename}`.replace(/[^\w.\-À-ÿ ]/g, "_");
    const file = folder.createFile(blob).setName(safeName);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (err) {}

    const fileId = file.getId();
    const fileUrl = file.getUrl();
    const previewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("envios") || ss.insertSheet("envios");
    ensureEnviosHeader(sheet);

    sheet.appendRow([
      new Date(),
      data.nome,
      data.desafio,
      Number(data.pontos || 0),
      fileUrl,
      safeName,
      fileId,
      data.mimeType,
      previewUrl,
      thumbnailUrl,
      data.deviceId || ""
    ]);

    return jsonResponse({
      ok: true,
      fileUrl,
      previewUrl,
      thumbnailUrl,
      ranking: getRanking(),
      galeria: getGaleria()
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}

function ensureEnviosHeader(sheet) {
  const header = [
    "data",
    "nome",
    "desafio",
    "pontos",
    "arquivo_url",
    "arquivo_nome",
    "file_id",
    "mime_type",
    "preview_url",
    "thumbnail_url",
    "device_id"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
    return;
  }

  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), header.length)).getValues()[0];

  header.forEach((name, index) => {
    if (!current[index]) {
      sheet.getRange(1, index + 1).setValue(name);
    }
  });
}

function getDesafios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("desafios");

  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1);

  return rows
    .filter(row => row[1])
    .map(row => ({
      id: row[0],
      desafio: row[1],
      pontos: Number(row[2] || 10)
    }));
}

function getRanking() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("envios");

  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);

  const nomeCol = idx["nome"] != null ? idx["nome"] : 1;
  const pontosCol = idx["pontos"] != null ? idx["pontos"] : 3;
  const devCol = idx["device_id"];

  const rows = values.slice(1);
  const map = {};

  rows.forEach(row => {
    const nome = String(row[nomeCol] || "").trim();
    if (!nome) return;

    const pontos = Number(row[pontosCol] || 0);
    const device = devCol != null ? String(row[devCol] || "").trim() : "";

    // Agrupa por aparelho. Sem device_id (envios antigos), agrupa pelo nome.
    const key = device || ("nome:" + nome.toLowerCase());

    if (!map[key]) {
      map[key] = { nome, pontos: 0, envios: 0, tag: device ? device.slice(-4) : "" };
    }

    map[key].pontos += pontos;
    map[key].envios += 1;
  });

  return Object.values(map).sort((a, b) => b.pontos - a.pontos);
}

function getGaleria() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("envios");

  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const rows = values.slice(1);

  const idx = {};
  headers.forEach((h, i) => idx[h] = i);

  return rows
    .filter(row => row[idx["arquivo_url"]] || row[idx["file_id"]])
    .reverse()
    .slice(0, 100)
    .map(row => {
      const fileId = row[idx["file_id"]] || extractDriveId(row[idx["arquivo_url"]]);
      const mimeType = row[idx["mime_type"]] || "";
      const fileUrl = row[idx["arquivo_url"]] || "";
      const previewUrl = row[idx["preview_url"]] || (fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : fileUrl);
      const thumbnailUrl = row[idx["thumbnail_url"]] || (fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : fileUrl);

      return {
        data: row[idx["data"]],
        nome: row[idx["nome"]],
        desafio: row[idx["desafio"]],
        pontos: Number(row[idx["pontos"]] || 0),
        fileUrl,
        fileId,
        arquivoNome: row[idx["arquivo_nome"]] || "",
        mimeType,
        previewUrl,
        thumbnailUrl,
        viewUrl: fileId ? `https://drive.google.com/file/d/${fileId}/view` : fileUrl
      };
    });
}

function extractDriveId(url) {
  if (!url) return "";
  const text = String(url);
  let match = text.match(/\/d\/([^/]+)/);
  if (match && match[1]) return match[1];
  match = text.match(/[?&]id=([^&]+)/);
  if (match && match[1]) return match[1];
  return "";
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
