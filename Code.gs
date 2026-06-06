/**
 * ============================================================================
 * BMW LINDAVISTA - Control de Herramientas
 * Apps Script complementario a la app AppSheet
 * ============================================================================
 *
 * FUNCIONES INCLUIDAS:
 *   1. generarQRsUbicaciones()    - Crea PDF imprimible con QRs de ubicaciones
 *   2. validarIntegridadDatos()   - Detecta duplicados, inconsistencias
 *   3. marcarVencidos()           - Marca movimientos VENCIDO (backup del bot)
 *   4. reporteAuditoriaMensual()  - Genera CSV del mes y lo envia por email
 *   5. webhookReceiver(e)         - Endpoint para recibir webhooks desde AppSheet
 *   6. instalarTriggers()         - Configura triggers automaticos (ejecutar 1 vez)
 *
 * INSTALACION:
 *   1. Abrir tu Google Sheet BD_HERRAMIENTAS_v2
 *   2. Menu Extensiones > Apps Script
 *   3. Pegar este archivo completo
 *   4. Editar la seccion CONFIG con tus valores
 *   5. Ejecutar instalarTriggers() una sola vez (autorizar permisos)
 *   6. Listo, las funciones programadas correran solas
 * ============================================================================
 */

// ============================================================================
// CONFIG - editar segun tu entorno
// ============================================================================
const CONFIG = {
  EMAIL_MANAGER: 'tu-email@bmwlindavista.com',  // <-- CAMBIAR
  NOMBRE_AGENCIA: 'BMW Lindavista',
  ZONA_HORARIA: 'America/Mexico_City',
  CARPETA_REPORTES_ID: '',                       // opcional: ID de carpeta Drive
  HOJA_HERRAMIENTAS: 'HERRAMIENTAS',
  HOJA_MOVIMIENTOS: 'MOVIMIENTOS',
  HOJA_USUARIOS: 'USUARIOS',
  HOJA_FAMILIAS: 'FAMILIAS',
};

// ============================================================================
// 1. GENERAR QR DE UBICACIONES
// ============================================================================
/**
 * Crea un PDF imprimible con un QR por cada ubicacion fisica.
 * Al escanear el QR, abre la app filtrada por esa ubicacion.
 */
function generarQRsUbicaciones() {
  const ss = SpreadsheetApp.getActive();
  const shHerr = ss.getSheetByName(CONFIG.HOJA_HERRAMIENTAS);
  if (!shHerr) throw new Error('No se encontro hoja ' + CONFIG.HOJA_HERRAMIENTAS);

  // Obtener ubicaciones unicas
  const ubicCol = shHerr.getRange(2, 8, shHerr.getLastRow() - 1, 1).getValues()
    .map(r => String(r[0]).trim())
    .filter(v => v && v !== '');
  const ubicaciones = [...new Set(ubicCol)].sort();

  Logger.log('Generando ' + ubicaciones.length + ' QRs de ubicaciones...');

  // Crear documento temporal para imprimir
  const doc = DocumentApp.create('QR_Ubicaciones_' + new Date().getTime());
  const body = doc.getBody();
  body.setMarginTop(36).setMarginBottom(36).setMarginLeft(36).setMarginRight(36);

  // Titulo
  const titulo = body.appendParagraph(CONFIG.NOMBRE_AGENCIA + ' - QR de Ubicaciones');
  titulo.setHeading(DocumentApp.ParagraphHeading.TITLE);
  titulo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph('Pegar cada QR en el cajon/estante correspondiente. Escanear desde la app AppSheet.')
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .setItalic(true)
    .setForegroundColor('#808080');

  // Crear tabla 2 columnas (2 QRs por fila)
  const numFilas = Math.ceil(ubicaciones.length / 2);
  const tabla = body.appendTable();

  for (let i = 0; i < numFilas; i++) {
    const fila = tabla.appendTableRow();

    for (let j = 0; j < 2; j++) {
      const idx = i * 2 + j;
      const cell = fila.appendTableCell();

      if (idx < ubicaciones.length) {
        const ubic = ubicaciones[idx];
        const dataQR = 'BMW-UBIC:' + ubic;
        const url = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(dataQR);

        try {
          const blob = UrlFetchApp.fetch(url).getBlob();
          cell.appendParagraph('').appendInlineImage(blob).setWidth(180).setHeight(180);
          cell.appendParagraph('UBICACION: ' + ubic)
            .setBold(true)
            .setFontSize(14)
            .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
          cell.appendParagraph(CONFIG.NOMBRE_AGENCIA)
            .setItalic(true)
            .setFontSize(9)
            .setForegroundColor('#808080')
            .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        } catch (err) {
          cell.appendParagraph('Error generando QR de ' + ubic);
        }
      } else {
        cell.appendParagraph('');
      }
    }
  }

  doc.saveAndClose();

  // Convertir a PDF
  const pdfBlob = DriveApp.getFileById(doc.getId()).getAs('application/pdf');
  pdfBlob.setName('QR_Ubicaciones_' + CONFIG.NOMBRE_AGENCIA.replace(/ /g, '_') + '.pdf');
  const pdfFile = DriveApp.createFile(pdfBlob);

  // Borrar el doc temporal
  DriveApp.getFileById(doc.getId()).setTrashed(true);

  Logger.log('PDF generado: ' + pdfFile.getUrl());
  SpreadsheetApp.getUi().alert('PDF generado correctamente.\n\nAbrir: ' + pdfFile.getUrl());

  return pdfFile.getUrl();
}

// ============================================================================
// 2. VALIDAR INTEGRIDAD DE DATOS
// ============================================================================
/**
 * Revisa la BD y reporta inconsistencias en una hoja AUDITORIA.
 * Ejecutar manualmente o via trigger semanal.
 */
function validarIntegridadDatos() {
  const ss = SpreadsheetApp.getActive();
  const shHerr = ss.getSheetByName(CONFIG.HOJA_HERRAMIENTAS);
  const shMov = ss.getSheetByName(CONFIG.HOJA_MOVIMIENTOS);

  const errores = [];
  const ahora = new Date();

  // Validacion 1: ID_HERRAMIENTA duplicados
  const ids = shHerr.getRange(2, 1, shHerr.getLastRow() - 1, 1).getValues().map(r => r[0]);
  const dupIds = ids.filter((v, i, a) => v && a.indexOf(v) !== i);
  if (dupIds.length) errores.push(['HERRAMIENTAS', 'ID duplicado', dupIds.join(', '), 'critico']);

  // Validacion 2: Movimientos PRESTADO con FECHA_DEV_ESPERADA pasada
  const movs = shMov.getRange(2, 1, shMov.getLastRow() - 1, shMov.getLastColumn()).getValues();
  let vencidosNoMarcados = 0;
  movs.forEach(row => {
    const estado = row[9];
    const fechaEsp = row[7];
    if (estado === 'PRESTADO' && fechaEsp instanceof Date && fechaEsp < ahora) {
      vencidosNoMarcados++;
    }
  });
  if (vencidosNoMarcados > 0) {
    errores.push(['MOVIMIENTOS', 'Vencidos no marcados', vencidosNoMarcados + ' registros', 'medio']);
  }

  // Validacion 3: Movimientos sin ID_HERRAMIENTA referenciado
  const idsSet = new Set(ids);
  let huerfanos = 0;
  movs.forEach(row => {
    if (row[2] && !idsSet.has(row[2])) huerfanos++;
  });
  if (huerfanos > 0) {
    errores.push(['MOVIMIENTOS', 'Referencias huerfanas a HERRAMIENTAS', huerfanos + ' registros', 'critico']);
  }

  // Validacion 4: Herramientas con CANT_TOTAL <= 0
  const cantTotal = shHerr.getRange(2, 9, shHerr.getLastRow() - 1, 1).getValues();
  let cantInvalida = 0;
  cantTotal.forEach(r => { if (Number(r[0]) <= 0) cantInvalida++; });
  if (cantInvalida > 0) {
    errores.push(['HERRAMIENTAS', 'CANT_TOTAL invalido (<=0)', cantInvalida + ' registros', 'bajo']);
  }

  // Escribir resultados
  let shAud = ss.getSheetByName('AUDITORIA');
  if (!shAud) shAud = ss.insertSheet('AUDITORIA');
  shAud.clear();
  shAud.appendRow(['Fecha', 'Tabla', 'Tipo error', 'Detalle', 'Severidad']);
  shAud.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');

  if (errores.length === 0) {
    shAud.appendRow([ahora, 'TODAS', 'Sin errores detectados', '-', 'ok']);
  } else {
    errores.forEach(e => shAud.appendRow([ahora, ...e]));
  }

  Logger.log('Validacion completada. Errores: ' + errores.length);
  return errores;
}

// ============================================================================
// 3. MARCAR VENCIDOS (backup del bot AppSheet)
// ============================================================================
function marcarVencidos() {
  const ss = SpreadsheetApp.getActive();
  const shMov = ss.getSheetByName(CONFIG.HOJA_MOVIMIENTOS);
  const rango = shMov.getRange(2, 1, shMov.getLastRow() - 1, shMov.getLastColumn());
  const datos = rango.getValues();
  const ahora = new Date();
  let cambiados = 0;

  datos.forEach((row, i) => {
    const estado = row[9];
    const fechaEsp = row[7];
    if (estado === 'PRESTADO' && fechaEsp instanceof Date && fechaEsp < ahora) {
      shMov.getRange(i + 2, 10).setValue('VENCIDO');
      cambiados++;
    }
  });

  Logger.log('Marcados como VENCIDO: ' + cambiados);
  return cambiados;
}

// ============================================================================
// 4. REPORTE DE AUDITORIA MENSUAL (CSV + email)
// ============================================================================
function reporteAuditoriaMensual() {
  const ss = SpreadsheetApp.getActive();
  const shMov = ss.getSheetByName(CONFIG.HOJA_MOVIMIENTOS);
  const datos = shMov.getDataRange().getValues();
  const headers = datos[0];

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

  const filtrados = datos.slice(1).filter(row => {
    const fecha = row[1];
    return fecha instanceof Date && fecha >= inicioMes && fecha <= finMes;
  });

  // Construir CSV
  const csv = [headers, ...filtrados].map(row =>
    row.map(v => {
      if (v instanceof Date) return Utilities.formatDate(v, CONFIG.ZONA_HORARIA, 'yyyy-MM-dd HH:mm:ss');
      return '"' + String(v).replace(/"/g, '""') + '"';
    }).join(',')
  ).join('\n');

  const blob = Utilities.newBlob(csv, 'text/csv',
    'Auditoria_' + Utilities.formatDate(inicioMes, CONFIG.ZONA_HORARIA, 'yyyy-MM') + '.csv');

  // Guardar en Drive
  let folder = CONFIG.CARPETA_REPORTES_ID
    ? DriveApp.getFolderById(CONFIG.CARPETA_REPORTES_ID)
    : DriveApp.getRootFolder();
  const file = folder.createFile(blob);

  // Email al manager
  const mesStr = Utilities.formatDate(inicioMes, CONFIG.ZONA_HORARIA, 'MMMM yyyy');
  MailApp.sendEmail({
    to: CONFIG.EMAIL_MANAGER,
    subject: 'Auditoria mensual herramientas - ' + mesStr,
    body: 'Adjunto el reporte de movimientos del mes ' + mesStr + '.\n\n' +
          'Total movimientos: ' + filtrados.length + '\n' +
          'Archivo en Drive: ' + file.getUrl() + '\n\n' +
          '-- Apps Script BMW Lindavista',
    attachments: [blob]
  });

  Logger.log('Reporte enviado. Total registros: ' + filtrados.length);
  return file.getUrl();
}

// ============================================================================
// 5. WEBHOOK RECEIVER (para integraciones futuras)
// ============================================================================
/**
 * AppSheet puede llamar a este endpoint via webhook (URL Web App).
 * Para activar: Implementar > Implementacion nueva > tipo Web App > Quien tiene acceso: Cualquiera.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    Logger.log('Webhook recibido: ' + JSON.stringify(data));

    // Aqui defines logica custom segun lo que envia AppSheet
    // Ejemplo: si data.action === 'critical_low_stock' -> enviar SMS

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', received: data }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// 6. INSTALAR TRIGGERS (ejecutar 1 sola vez)
// ============================================================================
function instalarTriggers() {
  // Borrar triggers existentes
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Trigger 1: Marcar vencidos cada dia a las 7AM
  ScriptApp.newTrigger('marcarVencidos')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .create();

  // Trigger 2: Validar integridad cada lunes 6AM
  ScriptApp.newTrigger('validarIntegridadDatos')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(6)
    .create();

  // Trigger 3: Reporte mensual el dia 1 de cada mes a las 9AM
  ScriptApp.newTrigger('reporteAuditoriaMensual')
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create();

  Logger.log('Triggers instalados:');
  ScriptApp.getProjectTriggers().forEach(t => {
    Logger.log(' - ' + t.getHandlerFunction() + ' (' + t.getTriggerSource() + ')');
  });

  SpreadsheetApp.getUi().alert('Triggers instalados correctamente.\n\n' +
    '- marcarVencidos: diario 7AM\n' +
    '- validarIntegridadDatos: lunes 6AM\n' +
    '- reporteAuditoriaMensual: dia 1 de cada mes 9AM');
}

// ============================================================================
// 7. MENU PERSONALIZADO EN LA HOJA
// ============================================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('BMW Herramientas')
    .addItem('Generar PDF de QRs (ubicaciones)', 'generarQRsUbicaciones')
    .addItem('Validar integridad de datos', 'validarIntegridadDatos')
    .addItem('Marcar vencidos ahora', 'marcarVencidos')
    .addItem('Enviar reporte mensual', 'reporteAuditoriaMensual')
    .addSeparator()
    .addItem('Instalar triggers automaticos', 'instalarTriggers')
    .addToUi();
}
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  
  if (data.accion === 'ALTA_HERRAMIENTA') {
    const ss = SpreadsheetApp.openById('1eXBSVybHtiEhuf3S0e-x4Bik9WDUTHdwJUS_-8A-74A');
    const hoja = ss.getSheetByName('HERRAMIENTAS');
    hoja.appendRow([
      data.id, '', data.np, '', data.tp, data.ds,
      data.gr, data.ub, data.ct, data.ct, 'ACTIVO',
      '', '', '', data.fecha_alta
    ]);
    return ContentService.createTextOutput('OK');
  }
  // ...resto de tu doPost existente
}
