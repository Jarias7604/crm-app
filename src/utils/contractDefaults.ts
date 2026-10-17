import type { ContractClause, ContractCompanyData, ContractClientData } from '../types/contracts';
import { format, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export interface ContractSeedData {
  company: {
    id: string;
    name: string;
    tax_id?: string | null;
    address?: string | null;
    phone?: string | null;
    logo_url?: string | null;
    website?: string | null;
    representante_legal?: string | null;
  };
  lead?: {
    id?: string;
    name: string;
    company_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    tax_id?: string | null;
  } | null;
  client?: any | null;
  cotizacion?: any | null;
  creatorName?: string;
  fechaInicio?: string;
  vigenciaMeses?: number;
  mesesGracia?: number;
  notas?: string;
}

export function generateContractDefaults(seed: ContractSeedData): {
  contract_number: string;
  title: string;
  objeto: string;
  clausulas: ContractClause[];
  monto_total: number;
  forma_pago: string;
  anticipo: number;
  cuotas: number;
  valor_cuota: number;
  vigencia_meses: number;
  fecha_inicio: string;
  fecha_fin: string;
  meses_gracia?: number;
  fecha_primer_cobro?: string;
  notas?: string;
  jurisdiccion: string;
  datos_empresa: ContractCompanyData;
  datos_cliente: ContractClientData;
} {
  const { company, lead, client, cotizacion, creatorName } = seed;
  const hoy = seed.fechaInicio ? new Date(`${seed.fechaInicio.substring(0, 10)}T12:00:00`) : new Date();
  const fechaInicioStr = format(hoy, 'yyyy-MM-dd');
  const vigenciaMeses = seed.vigenciaMeses || cotizacion?.plazo_meses || 12;
  const mesesGracia = seed.mesesGracia || 0;
  const fechaFin = addMonths(hoy, vigenciaMeses);
  const fechaFinStr = format(fechaFin, 'yyyy-MM-dd');
  const fechaPrimerCobro = mesesGracia > 0 ? addMonths(hoy, mesesGracia) : hoy;
  const fechaPrimerCobroStr = format(fechaPrimerCobro, 'yyyy-MM-dd');

  // Código correlativo de contrato
  const year = hoy.getFullYear();
  const randCode = Math.floor(1000 + Math.random() * 9000);
  const cotCode = cotizacion?.id ? cotizacion.id.slice(0, 4).toUpperCase() : `${randCode}`;
  const contract_number = `CON-${year}-${cotCode}`;

  const empresaNombre = company.name || 'La Empresa';
  const clienteNombre = client?.nombre || lead?.name || cotizacion?.nombre_cliente || 'El Cliente';
  const clienteEmpresa = client?.company_name_lead || lead?.company_name || cotizacion?.empresa_cliente || clienteNombre;
  const planNombre = cotizacion?.plan_nombre || 'Servicios Profesionales Especializados';

  // Montos
  const total = Number(cotizacion?.total_anual || cotizacion?.total_mensual || 0);
  const anticipo = Number(cotizacion?.monto_anticipo || 0);
  const cuotas = Number(cotizacion?.cuotas || 1);
  const remanente = Math.max(0, total - anticipo);
  const valorCuota = cuotas > 0 ? Math.round((remanente / cuotas) * 100) / 100 : 0;
  const totalStr = total.toLocaleString('en-US', { minimumFractionDigits: 2 });

  // Módulos o alcance complementario
  const modulos = Array.isArray(cotizacion?.modulos_adicionales)
    ? cotizacion.modulos_adicionales.map((m: any) => typeof m === 'string' ? m : m.nombre).join(', ')
    : '';

  const datos_empresa: ContractCompanyData = {
    nombre: empresaNombre,
    tax_id: company.tax_id || '',
    representante: company.representante_legal || creatorName || 'Representante Autorizado',
    email: (company as any).email || '',
    telefono: company.phone || '',
    direccion: company.address || '',
    ciudad_pais: company.address ? company.address.split(',').pop()?.trim() || 'San Salvador, El Salvador' : 'San Salvador, El Salvador',
    logo_url: company.logo_url || null,
    website: company.website || null,
  };

  const datos_cliente: ContractClientData = {
    nombre: clienteNombre,
    empresa: clienteEmpresa,
    tax_id: client?.tax_id || lead?.tax_id || '',
    email: client?.email || lead?.email || cotizacion?.email_cliente || '',
    telefono: client?.telefono || lead?.phone || cotizacion?.telefono_cliente || '',
    direccion: client?.direccion || lead?.address || cotizacion?.direccion_cliente || '',
    cargo: 'Representante Autorizado',
  };

  let formaPagoTexto = cotizacion?.tipo_pago === 'credito'
    ? `Financiado en ${cuotas} cuotas de $${valorCuota.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD con anticipo de $${anticipo.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD.`
    : cotizacion?.monto_anticipo > 0
    ? `Anticipo inicial de $${anticipo.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD y saldo contra entrega.`
    : `Pago de contado por un monto total de $${totalStr} USD.`;

  if (mesesGracia > 0) {
    const primerCobroTexto = format(fechaPrimerCobro, "d 'de' MMMM 'de' yyyy", { locale: es });
    formaPagoTexto += ` Se otorga un periodo de gracia promocional de ${mesesGracia} mes(es) sin cobro (Go-Live diferido), programándose el primer cobro efectivo para el día ${primerCobroTexto}.`;
  }

  const jurisdiccion = datos_empresa.ciudad_pais || 'San Salvador, El Salvador';
  const fechaInicioTexto = format(hoy, "d 'de' MMMM 'de' yyyy", { locale: es });
  const fechaFinTexto = format(fechaFin, "d 'de' MMMM 'de' yyyy", { locale: es });

  const objetoTexto = `Prestación de servicios, suministro y/o licenciamiento correspondientes a "${planNombre}"${
    modulos ? ` con alcance en: ${modulos}` : ''
  }, conforme a las especificaciones acordadas en la propuesta comercial oficial.`;

  const clausulas: ContractClause[] = [
    {
      id: 'c1',
      numero: 'PRIMERA',
      titulo: 'OBJETO Y ALCANCE DE LOS SERVICIOS',
      contenido: `EL PRESTADOR se compromete y obliga a prestar a favor de EL CLIENTE los servicios profesionales, técnicos o de suministro correspondientes a "${planNombre}"${
        modulos ? `, integrando los siguientes alcances: ${modulos}` : ''
      }. Todos los trabajos se realizarán bajo rigurosos estándares profesionales y de estricta conformidad con las especificaciones acordadas.`,
      es_personalizada: false,
    },
    {
      id: 'c2',
      numero: 'SEGUNDA',
      titulo: 'PRECIO, CONDICIONES ECONÓMICAS Y FORMA DE PAGO',
      contenido: `Como contraprestación por los servicios objeto del presente contrato, EL CLIENTE se obliga a pagar a EL PRESTADOR la suma total de $${totalStr} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA (USD), moneda de curso legal. La modalidad y condiciones de pago acordadas son las siguientes: ${formaPagoTexto} Todo retraso en los pagos pactados superior a diez (10) días naturales devengará un interés moratorio legal del 2% mensual sobre saldos insolutos, reconociéndose a este contrato fuerza ejecutiva mercantil.`,
      es_personalizada: false,
    },
    {
      id: 'c3',
      numero: 'TERCERA',
      titulo: 'PLAZOS DE ENTREGA Y EJECUCIÓN',
      contenido: `EL PRESTADOR iniciará la prestación de los servicios a partir de la suscripción del presente instrumento y de la confirmación del anticipo o pago convenido. Los avances y entregables se desarrollarán de conformidad con el cronograma acordado de mutuo consentimiento entre las partes.`,
      es_personalizada: false,
    },
    {
      id: 'c4',
      numero: 'CUARTA',
      titulo: 'VIGENCIA Y RENOVACIÓN CONTRACTUAL',
      contenido: `El presente contrato tendrá una vigencia de ${vigenciaMeses} meses calendario, contados a partir del ${fechaInicioTexto} hasta el ${fechaFinTexto}. Se prorrogará automáticamente por períodos iguales a menos que cualquiera de las partes notifique por escrito su intención de no renovarlo con al menos treinta (30) días de anticipación al vencimiento.`,
      es_personalizada: false,
    },
    {
      id: 'c5',
      numero: 'QUINTA',
      titulo: 'OBLIGACIONES Y RESPONSABILIDADES DE LAS PARTES',
      contenido: `Son obligaciones de EL PRESTADOR: a) Ejecutar los servicios con la diligencia técnica y profesional debida; b) Brindar soporte técnico y atención de incidencias en los canales habilitados; c) Mantener absoluta reserva y confidencialidad. Son obligaciones de EL CLIENTE: a) Suministrar oportunamente la información o insumos necesarios para la debida prestación; b) Cumplir puntualmente con los pagos convenidos; c) Hacer uso legal y autorizado de los servicios provistos.`,
      es_personalizada: false,
    },
    {
      id: 'c6',
      numero: 'SEXTA',
      titulo: 'PROPIEDAD INTELECTUAL Y DERECHOS DE USO',
      contenido: `Todo software, plataforma, arquitectura, metodología o diseño utilizado o desarrollado por EL PRESTADOR continúa siendo de su propiedad exclusiva o de sus respectivos licenciantes conforme a la Ley de Propiedad Intelectual. Se otorga a EL CLIENTE una licencia de uso corporativa, intransferible y no exclusiva durante la vigencia del contrato para los fines estipulados.`,
      es_personalizada: false,
    },
    {
      id: 'c7',
      numero: 'SÉPTIMA',
      titulo: 'CONFIDENCIALIDAD Y PROTECCIÓN DE DATOS',
      contenido: `Ambas partes acuerdan tratar como información confidencial toda información técnica, operativa, comercial o financiera compartida en el marco de este contrato. Esta obligación de secreto y no divulgación permanecerá vigente durante la vigencia del contrato y por un período mínimo de tres (3) años posteriores a su terminación.`,
      es_personalizada: false,
    },
    {
      id: 'c8',
      numero: 'OCTAVA',
      titulo: 'CAUSALES DE RESOLUCIÓN Y TERMINACIÓN ANTICIPADA',
      contenido: `Serán causas de terminación justificada sin responsabilidad para la parte cumplida: a) El incumplimiento grave de cualquiera de las cláusulas no subsanado en un plazo de quince (15) días hábiles tras notificación escrita; b) La falta de pago continuada por más de treinta (30) días; c) Acuerdo mutuo formalizado por escrito entre las partes.`,
      es_personalizada: false,
    },
    {
      id: 'c9',
      numero: 'NOVENA',
      titulo: 'VALIDEZ Y EFICACIA JURÍDICA DE LA FIRMA ELECTRÓNICA (LEY N° 688)',
      contenido: `De conformidad con lo dispuesto en la Ley de Firma Electrónica (Decreto Legislativo N° 688) y su Reglamento, las partes reconocen y aceptan de manera expresa que la firma electrónica o digital consignada en este documento por medios telemáticos o pantallas táctiles, junto con el registro inmutable de fecha, hora, dirección IP y hash criptográfico de auditoría, goza de plena validez jurídica, valor probatorio y fuerza ejecutiva vinculante idéntica a la firma autógrafa manuscrita.`,
      es_personalizada: false,
    },
    {
      id: 'c10',
      numero: 'DÉCIMA',
      titulo: 'DOMICILIO ESPECIAL, JURISDICCIÓN Y LEY APLICABLE',
      contenido: `Para todos los efectos legales, judiciales o extrajudiciales que se deriven del presente contrato, ambas partes señalan de común acuerdo como domicilio especial la ciudad de ${jurisdiccion}, a cuyos tribunales y jueces competentes se someten expresamente en caso de controversia, renunciando al fuero de sus domicilios particulares conforme a las disposiciones procesales y mercantiles aplicables.`,
      es_personalizada: false,
    },
  ];

  return {
    contract_number,
    title: `Contrato de Prestación de Servicios — ${clienteEmpresa}`,
    objeto: objetoTexto,
    clausulas,
    monto_total: total,
    forma_pago: formaPagoTexto,
    anticipo,
    cuotas,
    valor_cuota: valorCuota,
    vigencia_meses: vigenciaMeses,
    fecha_inicio: fechaInicioStr,
    fecha_fin: fechaFinStr,
    meses_gracia: mesesGracia,
    fecha_primer_cobro: fechaPrimerCobroStr,
    notas: seed.notas || '',
    jurisdiccion,
    datos_empresa,
    datos_cliente,
  };
}
