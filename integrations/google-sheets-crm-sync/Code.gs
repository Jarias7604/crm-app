/**
 * Arias CRM — Sincronización Automática Privada (Google Sheets -> CRM)
 * -------------------------------------------------------------------
 * Proyecto Google Apps Script independiente (https://script.new) propiedad
 * exclusiva de tu cuenta. Lee el Excel por su ID cada 5 minutos, 24/7,
 * sin exponer código ni credenciales dentro de la hoja original.
 */

const SPREADSHEET_ID = '1PyW-el-5_QcVRUdnSNQFZ_z5OOhFF6ZUME7WYlqz5GU';
const CRM_WEBHOOK_URL =
  'https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/google-sheets-lead-intake';
const HEADER_STATUS_CRM = 'ESTADO CRM';
const MAX_BATCH_SIZE = 25;

/**
 * Función principal (seleccionada por defecto): guarda credenciales privadas,
 * verifica acceso al Google Sheet y al CRM, instala el disparador cada 5 minutos
 * y ejecuta una primera sincronización inmediata.
 */
function configurarYActivar24x7(secretOpcional) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('CRM_WEBHOOK_URL', CRM_WEBHOOK_URL);

  const secretToSave =
    (secretOpcional && String(secretOpcional).trim()) ||
    'REEMPLAZAR_CON_SHEETS_SYNC_SECRET';
  if (secretToSave === 'REEMPLAZAR_CON_SHEETS_SYNC_SECRET') {
    throw new Error(
      'Reemplaza REEMPLAZAR_CON_SHEETS_SYNC_SECRET por tu clave secreta antes de ejecutar.',
    );
  }
  props.setProperty('CRM_SYNC_SECRET', secretToSave);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const leadSheets = ss.getSheets().filter(esPestanaDeLeads_).map((s) => s.getName());
  Logger.log('📄 Hoja conectada: ' + ss.getName() + ' | Pestañas de leads: ' + leadSheets.join(', '));

  const res = UrlFetchApp.fetch(CRM_WEBHOOK_URL, {
    method: 'get',
    headers: { 'x-sheets-sync-secret': secretToSave },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Error al conectar con Arias CRM (HTTP ' + code + '): ' + res.getContentText());
  }
  Logger.log('✅ Conexión exitosa con Arias CRM: ' + res.getContentText());

  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((t) => {
    if (t.getHandlerFunction() === 'sincronizarLeadsCRM') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('sincronizarLeadsCRM').timeBased().everyMinutes(5).create();

  sincronizarLeadsCRM();
  Logger.log('✅ Automatización 24/7 activada correctamente. Ya puedes cerrar esta ventana.');
}

function normalizarTexto_(val) {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function esPestanaDeLeads_(sheet) {
  if (!sheet) return false;
  const name = sheet.getName();
  if (/^(an[aá]lisis|resumen|dashboard|config|plantilla)/i.test(name)) {
    return false;
  }
  const lastCol = sheet.getLastColumn();
  if (lastCol < 3 || sheet.getLastRow() < 1) return false;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizarTexto_);
  const hasName = headers.some(
    (h) => h === 'NOMBRE COMPLETO' || h === 'NOMBRE' || h === 'FULL NAME' || h === 'CONTACTO',
  );
  const hasPhone = headers.some(
    (h) => h === 'TELEFONO' || h === 'CELULAR' || h === 'WHATSAPP' || h === 'PHONE' || h === 'MOVIL',
  );
  return hasName && hasPhone;
}

function asegurarColumnaEstado_(sheet) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let i = 0; i < headers.length; i++) {
    if (normalizarTexto_(headers[i]) === HEADER_STATUS_CRM) {
      return i + 1;
    }
  }
  const newCol = lastCol + 1;
  const headerCell = sheet.getRange(1, newCol);
  headerCell.setValue(HEADER_STATUS_CRM);
  headerCell.setFontWeight('bold');
  return newCol;
}

function obtenerCredencialesCRM_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('CRM_WEBHOOK_URL') || CRM_WEBHOOK_URL;
  const secret = props.getProperty('CRM_SYNC_SECRET') || '';
  if (!secret || secret === 'REEMPLAZAR_CON_SHEETS_SYNC_SECRET') {
    throw new Error(
      'Falta configurar CRM_SYNC_SECRET en PropertiesService. Ejecuta configurarYActivar24x7().',
    );
  }
  return { url, secret };
}

function probarConexionCRM() {
  const creds = obtenerCredencialesCRM_();
  const res = UrlFetchApp.fetch(creds.url, {
    method: 'get',
    headers: { 'x-sheets-sync-secret': creds.secret },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code >= 200 && code < 300) {
    Logger.log('✅ Conexión exitosa con Arias CRM: ' + res.getContentText());
  } else {
    throw new Error('⚠️ Error de conexión (' + code + '): ' + res.getContentText());
  }
}

function marcarFilasActualesComoCargadas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tz = 'America/El_Salvador';
  const fecha = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy');
  let marcadas = 0;

  ss.getSheets().forEach((sheet) => {
    if (!esPestanaDeLeads_(sheet)) return;
    const statusCol = asegurarColumnaEstado_(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const statusRange = sheet.getRange(2, statusCol, lastRow - 1, 1);
    const statusVals = statusRange.getValues();
    const rowData = sheet.getRange(2, 1, lastRow - 1, statusCol - 1).getValues();

    let dirty = false;
    for (let i = 0; i < statusVals.length; i++) {
      const currentStatus = String(statusVals[i][0] || '').trim();
      const hasAnyData = rowData[i].some((c) => String(c || '').trim() !== '');
      if (!currentStatus && hasAnyData) {
        statusVals[i][0] = '📌 Histórico previo (' + fecha + ')';
        dirty = true;
        marcadas++;
      }
    }
    if (dirty) {
      statusRange.setValues(statusVals);
    }
  });

  Logger.log('Filas marcadas como histórico previo: ' + marcadas);
}

function sincronizarLeadsCRM() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    Logger.log('Otro proceso de sincronización sigue activo; se omite esta corrida.');
    return;
  }

  try {
    const creds = obtenerCredencialesCRM_();
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const spreadsheetId = ss.getId();
    let totalProcessed = 0;

    ss.getSheets().forEach((sheet) => {
      if (!esPestanaDeLeads_(sheet)) return;

      const statusCol = asegurarColumnaEstado_(sheet);
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return;

      const lastCol = Math.max(sheet.getLastColumn(), statusCol);
      const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      const headers = values[0].map((h) => String(h || '').trim());
      const normHeaders = headers.map(normalizarTexto_);

      const idxName = normHeaders.findIndex(
        (h) => h === 'NOMBRE COMPLETO' || h === 'NOMBRE' || h === 'FULL NAME' || h === 'CONTACTO',
      );
      const idxPhone = normHeaders.findIndex(
        (h) => h === 'TELEFONO' || h === 'CELULAR' || h === 'WHATSAPP' || h === 'PHONE' || h === 'MOVIL',
      );
      const idxEmail = normHeaders.findIndex(
        (h) => h === 'CORREO ELECTRONICO' || h === 'CORREO' || h === 'EMAIL' || h === 'E-MAIL' || h === 'MAIL',
      );

      const pendingRows = [];
      for (let r = 1; r < values.length; r++) {
        const rowArr = values[r];
        const existingStatus = String(rowArr[statusCol - 1] || '').trim();
        if (existingStatus) continue;

        const hasName = idxName >= 0 && String(rowArr[idxName] || '').trim() !== '';
        const hasPhone = idxPhone >= 0 && String(rowArr[idxPhone] || '').trim() !== '';
        const hasEmail = idxEmail >= 0 && String(rowArr[idxEmail] || '').trim() !== '';
        if (!hasName && !hasPhone && !hasEmail) continue;

        const rowObj = {};
        for (let c = 0; c < headers.length; c++) {
          if (c === statusCol - 1 || !headers[c]) continue;
          const cellVal = rowArr[c];
          if (cellVal instanceof Date) {
            rowObj[headers[c]] = Utilities.formatDate(cellVal, 'America/El_Salvador', 'dd/MM/yyyy HH:mm:ss');
          } else {
            rowObj[headers[c]] = cellVal;
          }
        }

        pendingRows.push({
          rowNumber: r + 1,
          row: rowObj,
        });
      }

      if (pendingRows.length === 0) return;

      const sheetName = sheet.getName();
      for (let i = 0; i < pendingRows.length; i += MAX_BATCH_SIZE) {
        const batch = pendingRows.slice(i, i + MAX_BATCH_SIZE);
        const res = UrlFetchApp.fetch(creds.url, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-sheets-sync-secret': creds.secret },
          payload: JSON.stringify({
            spreadsheetId,
            sheetName,
            rows: batch,
          }),
          muteHttpExceptions: true,
        });

        const code = res.getResponseCode();
        if (code < 200 || code >= 300) {
          throw new Error(
            'Error HTTP ' + code + ' en pestaña "' + sheetName + '": ' + res.getContentText(),
          );
        }

        const parsed = JSON.parse(res.getContentText());
        const results = Array.isArray(parsed.results) ? parsed.results : [];
        results.forEach((item) => {
          if (item && item.rowNumber && item.statusText) {
            sheet.getRange(Number(item.rowNumber), statusCol).setValue(String(item.statusText));
            totalProcessed++;
          }
        });
      }
    });

    if (totalProcessed > 0) {
      Logger.log('Sincronización completada: ' + totalProcessed + ' fila(s) procesada(s).');
    } else {
      Logger.log('Sin filas nuevas pendientes.');
    }
  } finally {
    lock.releaseLock();
  }
}
