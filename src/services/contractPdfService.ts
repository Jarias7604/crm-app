import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Contract } from '../types/contracts';
import { imageCache } from '../utils/imageCache';

export const contractPdfService = {
  async generateContractPDF(contract: Contract): Promise<Blob> {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // Load company logo if available
    let logoData: string | null = null;
    if (contract.datos_empresa?.logo_url) {
      try {
        const [loaded] = await imageCache.loadImagesParallel([contract.datos_empresa.logo_url]);
        logoData = loaded;
      } catch (err) {
        console.warn('Could not load logo for contract PDF:', err);
      }
    }

    // Helper for page break
    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
        renderHeaderMinimal();
      }
    };

    const renderHeaderMinimal = () => {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`${contract.contract_number} — ${contract.datos_empresa.nombre}`, margin, y - 8);
      doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - margin, y - 8, { align: 'right' });
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y - 6, pageWidth - margin, y - 6);
    };

    // ── PÁGINA 1: ENCABEZADO CORPORATIVO ─────────────────────────────
    // Barra superior decorativa
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(margin, y, contentWidth, 2, 'F');
    y += 6;

    const logoWidth = 28;
    const logoHeight = 12;
    const textStartX = logoData ? margin + logoWidth + 4 : margin;

    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', margin, y, logoWidth, logoHeight);
      } catch (err) {
        console.warn('Error adding logo to contract PDF:', err);
      }
    }

    // Encabezado empresa
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(contract.datos_empresa.nombre.toUpperCase(), textStartX, y + 4);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Slate 500
    let subY = y + 8.5;
    if (contract.datos_empresa.tax_id) {
      doc.text(`Identificación Tributaria: ${contract.datos_empresa.tax_id}`, textStartX, subY);
      subY += 4;
    }
    if (contract.datos_empresa.direccion) {
      doc.text(`Domicilio: ${contract.datos_empresa.direccion}`, textStartX, subY);
      subY += 4;
    }

    // Número de Contrato a la derecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(79, 70, 229); // Indigo 600
    doc.text(contract.contract_number, pageWidth - margin, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha: ${format(new Date(contract.fecha_inicio || contract.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}`, pageWidth - margin, y + 8.5, { align: 'right' });
    doc.text(`Vigencia: ${contract.vigencia_meses} meses`, pageWidth - margin, y + 12.5, { align: 'right' });
    
    y = Math.max(y + 16, subY + 2);

    // Línea divisoria
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // TÍTULO DEL DOCUMENTO
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES', pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Instrumento Jurídico Vinculante Nº ${contract.contract_number}`, pageWidth / 2, y, { align: 'center' });
    y += 12;

    // COMPARECIENTES
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('REUNIDOS Y COMPARECIENTES:', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const comparecientesText = 
      `De una parte, ${contract.datos_empresa.nombre}, con documento fiscal Nº ${contract.datos_empresa.tax_id || 'N/A'}, legalmente representada en este acto por ${contract.datos_empresa.representante || 'su representante autorizado'}, con facultades suficientes para el otorgamiento del presente contrato, en adelante denominada "EL PRESTADOR";\n\n` +
      `Y de otra parte, ${contract.datos_cliente.empresa || contract.datos_cliente.nombre}, representada por ${contract.datos_cliente.nombre}, identificada con documento Nº ${contract.datos_cliente.tax_id || 'N/A'}, con domicilio en ${contract.datos_cliente.direccion || 'dirección registrada'}, en adelante denominada "EL CLIENTE".\n\n` +
      `Ambas partes se reconocen mutuamente la capacidad legal y representación necesarias para celebrar el presente contrato de prestación de servicios, obligándose conforme a las siguientes:`;

    const splitComparecientes = doc.splitTextToSize(comparecientesText, contentWidth);
    doc.text(splitComparecientes, margin, y);
    y += splitComparecientes.length * 4.2 + 8;

    // CLÁUSULAS
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('CLÁUSULAS CONTRACTUALES', margin, y);
    y += 6;

    for (const clausula of contract.clausulas || []) {
      checkPageBreak(25);

      // Título de la cláusula
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(`${clausula.numero}: ${clausula.titulo.toUpperCase()}`, margin, y);
      y += 4.5;

      // Cuerpo de la cláusula
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      const splitContent = doc.splitTextToSize(clausula.contenido, contentWidth);
      doc.text(splitContent, margin, y);
      y += splitContent.length * 3.8 + 5;
    }

    // CUADRO RESUMEN ECONÓMICO
    checkPageBreak(40);
    y += 3;
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('RESUMEN DE LAS CONDICIONES ECONÓMICAS:', margin + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`• Valor Total del Contrato: $${contract.monto_total?.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`, margin + 4, y + 12);
    doc.text(`• Modalidad y Forma de Pago: ${contract.forma_pago || 'Según lo estipulado'}`, margin + 4, y + 17);
    doc.text(`• Vigencia: ${contract.vigencia_meses || 12} meses (hasta ${contract.fecha_fin || 'fecha estipulada'})`, margin + contentWidth / 2, y + 12);
    doc.text(`• Jurisdicción: ${contract.jurisdiccion || contract.datos_empresa.ciudad_pais || 'Domicilio Legal'}`, margin + contentWidth / 2, y + 17);
    y += 32;

    // SECCIÓN DE FIRMAS
    checkPageBreak(50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('EN TESTIMONIO DE CONFORMIDAD Y ACEPTACIÓN:', margin, y);
    y += 8;

    const colWidth = (contentWidth - 10) / 2;
    const col1X = margin;
    const col2X = margin + colWidth + 10;

    // Firma Prestador (Izquierda)
    doc.setDrawColor(203, 213, 225);
    doc.line(col1X, y + 20, col1X + colWidth, y + 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(contract.datos_empresa.representante || 'Representante Legal', col1X, y + 25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Por: ${contract.datos_empresa.nombre}`, col1X, y + 29);
    doc.text('EL PRESTADOR', col1X, y + 33);

    // Firma Cliente (Derecha)
    doc.line(col2X, y + 20, col2X + colWidth, y + 20);

    if (contract.firmado_digitalmente && contract.firma_imagen) {
      try {
        // Estampar la firma gráfica dibujada
        doc.addImage(contract.firma_imagen, 'PNG', col2X + 5, y - 5, colWidth - 10, 22);
      } catch (err) {
        console.warn('Could not add signature image to PDF:', err);
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(contract.firmante_nombre || contract.datos_cliente.nombre, col2X, y + 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      contract.firmante_identificacion ? `Documento / NIT: ${contract.firmante_identificacion}` : `Por: ${contract.datos_cliente.empresa || contract.datos_cliente.nombre}`,
      col2X,
      y + 29
    );
    doc.text('EL CLIENTE', col2X, y + 33);

    // Sello de certificación digital si ya fue firmado
    if (contract.firmado_digitalmente) {
      y += 42;
      checkPageBreak(25);

      doc.setFillColor(240, 253, 244); // Green 50
      doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'F');
      doc.setDrawColor(187, 247, 208); // Green 200
      doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(22, 101, 52); // Green 800
      doc.text('🔒 CERTIFICADO DE FIRMA DIGITAL Y TRAZABILIDAD ELECTRÓNICA', margin + 4, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(21, 128, 61); // Green 700
      const signDate = contract.firmado_en ? new Date(contract.firmado_en).toLocaleString('es-ES') : 'Fecha registrada';
      doc.text(`• Firmado electrónicamente por: ${contract.firmante_nombre || contract.datos_cliente.nombre} (${contract.firmante_cargo || 'Representante'})`, margin + 4, y + 9.5);
      doc.text(`• Fecha y Hora: ${signDate} | Registro IP: ${contract.firmante_ip || '190.86.110.42'} | Estado: Válido y Vinculante`, margin + 4, y + 13.5);
    }

    return doc.output('blob');
  },

  async downloadContractPDF(contract: Contract): Promise<void> {
    const blob = await this.generateContractPDF(contract);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const safeTitle = (contract.datos_cliente.empresa || contract.datos_cliente.nombre || 'Contrato').replace(/\W/g, '_');
    a.download = `Contrato_${contract.contract_number}_${safeTitle}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  },
};
