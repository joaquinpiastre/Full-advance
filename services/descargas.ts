import { Alert, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { urlFoto } from '../constants';

const ALBUM = 'Full Advance';

// Descarga una foto de una visita y la guarda en la galería del teléfono
// (en un álbum "Full Advance" para que sea fácil encontrarlas).
export async function descargarFoto(uriRelativa?: string | null) {
  const url = urlFoto(uriRelativa);
  if (!url) return;
  const nombreArchivo = url.split('/').pop() || `foto-${Date.now()}.jpg`;

  if (Platform.OS === 'web') {
    try {
      const respuesta = await fetch(url);
      const blob = await respuesta.blob();
      const objectUrl = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = objectUrl;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.alert('No se pudo descargar la foto');
    }
    return;
  }

  try {
    const permiso = await MediaLibrary.requestPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Para guardar la foto, dale permiso de acceso a tus fotos en los ajustes del teléfono.');
      return;
    }

    const destino = new File(Paths.cache, nombreArchivo);
    const archivo = await File.downloadFileAsync(url, destino);

    const asset = await MediaLibrary.createAssetAsync(archivo.uri);
    const album = await MediaLibrary.getAlbumAsync(ALBUM);
    if (album) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    } else {
      await MediaLibrary.createAlbumAsync(ALBUM, asset, false);
    }

    Alert.alert('Listo', `La foto se guardó en la galería, en el álbum "${ALBUM}"`);
  } catch {
    Alert.alert('Error', 'No se pudo descargar la foto');
  }
}

const filaParada = (p: any, index: number) => {
  const llegada = p.timestamp_llegada ? format(new Date(p.timestamp_llegada), 'HH:mm') : '–';
  const salida = p.timestamp_salida ? format(new Date(p.timestamp_salida), 'HH:mm') : '–';
  const fotos = [p.foto1_uri, p.foto2_uri, p.foto3_uri, p.foto4_uri, p.foto5_uri].filter(Boolean).map(urlFoto);

  const detalles: string[] = [];
  if (p.tiene_vencidos) {
    detalles.push(
      `⚠️ Mercadería vencida${p.mercaderia_vencida ? `: ${p.mercaderia_vencida}` : ''}` +
      (p.fecha_vencimiento ? ` (${p.fecha_vencimiento === 'Vencida' ? 'ya vencida' : `vence ${p.fecha_vencimiento}`})` : '') +
      (p.nota_vencido ? ` - Nota: ${p.nota_vencido}` : '')
    );
  }
  if (p.urgente) {
    detalles.push(`🚨 Urgente${p.urgencia_descripcion ? `: ${p.urgencia_descripcion}` : ''}`);
  }
  if (p.accion_requerida) {
    detalles.push(`🔧 Acción requerida: ${p.accion_requerida}`);
  }
  if (p.oportunidades) {
    detalles.push(`💡 Oportunidades: ${p.oportunidades}`);
  }

  return `
    <div class="parada">
      <div class="parada-header">
        <span class="parada-numero">${index + 1}</span>
        <div>
          <div class="parada-nombre">${p.cliente?.nombre ?? 'Sin cliente'}</div>
          <div class="parada-direccion">${p.cliente?.direccion ?? ''}</div>
        </div>
        <div class="parada-horario">${llegada} → ${salida}</div>
      </div>
      ${p.nota ? `<div class="parada-nota">📝 ${p.nota}</div>` : ''}
      ${detalles.length ? `<div class="parada-detalles">${detalles.map((d) => `<div class="parada-detalle">${d}</div>`).join('')}</div>` : ''}
      ${fotos.length ? `<div class="parada-fotos">${fotos.map((f) => `<img src="${f}" />`).join('')}</div>` : ''}
    </div>
  `;
};

const generarHtmlReporte = (detalle: any) => {
  const inicio = new Date(detalle.fecha_inicio);
  const fin = detalle.fecha_fin ? new Date(detalle.fecha_fin) : null;
  const duracion = fin ? differenceInMinutes(fin, inicio) : null;
  const paradas = detalle.paradas ?? [];
  const completadas = paradas.filter((p: any) => p.completada).length;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1A1A2E; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .subtitulo { color: #6B7280; font-size: 13px; margin-bottom: 18px; text-transform: capitalize; }
          .resumen { display: flex; gap: 14px; margin-bottom: 22px; }
          .resumen-item { background: #F5F7FA; border-radius: 10px; padding: 12px 16px; flex: 1; }
          .resumen-label { font-size: 11px; color: #6B7280; text-transform: uppercase; font-weight: 700; }
          .resumen-valor { font-size: 16px; font-weight: 800; margin-top: 2px; }
          .parada { border: 1px solid #E5E7EB; border-radius: 12px; padding: 14px; margin-bottom: 12px; page-break-inside: avoid; }
          .parada-header { display: flex; align-items: center; gap: 12px; }
          .parada-numero { background: #1A3A5C; color: #fff; width: 26px; height: 26px; border-radius: 13px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
          .parada-nombre { font-weight: 700; font-size: 14px; }
          .parada-direccion { font-size: 12px; color: #6B7280; }
          .parada-horario { margin-left: auto; font-size: 13px; font-weight: 700; color: #1A3A5C; }
          .parada-nota { margin-top: 8px; font-size: 13px; font-style: italic; color: #1A1A2E; }
          .parada-detalles { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
          .parada-detalle { font-size: 13px; font-weight: 600; color: #D97706; }
          .parada-fotos { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
          .parada-fotos img { width: 105px; height: 105px; object-fit: cover; border-radius: 8px; }
        </style>
      </head>
      <body>
        <h1>Reporte de jornada — ${detalle.usuario?.nombre ?? ''}</h1>
        <div class="subtitulo">${format(inicio, "EEEE d 'de' MMMM yyyy", { locale: es })}</div>
        <div class="resumen">
          <div class="resumen-item">
            <div class="resumen-label">Horario</div>
            <div class="resumen-valor">${format(inicio, 'HH:mm')}${fin ? ` → ${format(fin, 'HH:mm')}` : ' (en curso)'}</div>
          </div>
          ${duracion !== null ? `
          <div class="resumen-item">
            <div class="resumen-label">Duración</div>
            <div class="resumen-valor">${duracion} min</div>
          </div>` : ''}
          <div class="resumen-item">
            <div class="resumen-label">Paradas</div>
            <div class="resumen-valor">${completadas} de ${paradas.length} completadas</div>
          </div>
        </div>
        ${paradas.map(filaParada).join('')}
      </body>
    </html>
  `;
};

// Genera un reporte HTML de la jornada (cliente por cliente, horarios, notas y fotos).
// En el celular crea un PDF y abre el panel de compartir; en la web abre el diálogo
// de impresión del navegador, donde se puede elegir "Guardar como PDF".
export async function descargarReporteJornada(detalle: any) {
  const html = generarHtmlReporte(detalle);

  if (Platform.OS === 'web') {
    const ventana = window.open('', '_blank');
    if (!ventana) {
      window.alert('Habilitá las ventanas emergentes del navegador para generar el PDF');
      return;
    }
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => ventana.print(), 400);
    return;
  }

  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const disponible = await Sharing.isAvailableAsync();
    if (!disponible) {
      Alert.alert('Listo', 'El PDF se generó pero no se puede compartir en este dispositivo');
      return;
    }
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Reporte de jornada' });
  } catch {
    Alert.alert('Error', 'No se pudo generar el PDF');
  }
}
