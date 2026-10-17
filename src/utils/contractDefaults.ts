import type { ContractClause, ContractCompanyData, ContractClientData } from '../types/contracts';
import { format, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface ContractSeedData {
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
  cotizacion?: any | null;
  creatorName?: string;
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
  jurisdiccion: string;
  datos_empresa: ContractCompanyData;
  datos_cliente: ContractClientData;
} {
  const { company, lead, cotizacion, creatorName } = seed;
  const hoy = new Date();
  const fechaInicioStr = format(hoy, 'yyyy-MM-dd');
  const vigenciaMeses = cotizacion?.plazo_meses || 12;
  const fechaFinStr = format(addMonths(hoy, vigenciaMeses), 'yyyy-MM-dd');

  // Random or sequential contract code
  const year = hoy.getFullYear();
  const randCode = Math.floor(1000 + Math.random() * 9000);
  const cotCode = cotizacion?.id ? cotizacion.id.slice(0, 4).toUpperCase() : `${randCode}`;
  const contract_number = `CON-${year}-${cotCode}`;

  const empresaNombre = company.name || 'La Empresa';
  const clienteNombre = lead?.name || cotizacion?.nombre_cliente || 'El Cliente';
  const clienteEmpresa = lead?.company_name || cotizacion?.empresa_cliente || clienteNombre;
  const planNombre = cotizacion?.plan_nombre || 'Servicios Profesionales Especializados';

  // Montos
  const total = Number(cotizacion?.total_anual || cotizacion?.total_mensual || 0);
  const anticipo = Number(cotizacion?.monto_anticipo || 0);
  const cuotas = Number(cotizacion?.cuotas || 1);
  const remanente = Math.max(0, total - anticipo);
  const valorCuota = cuotas > 0 ? Math.round((remanente / cuotas) * 100) / 100 : 0;

  // Modulos adicionales format
  const modulos = Array.isArray(cotizacion?.modulos_adicionales)
    ? cotizacion.modulos_adicionales.map((m: any) => typeof m === 'string' ? m : m.nombre).join(', ')
    : '';

  const objetoTexto = `Prestación de servicios profesionales integrales y licenciamiento correspondientes a "${planNombre}"${
    modulos ? ` con módulos y alcance adicional en: ${modulos}` : ''
  }, conforme a las especificaciones acordadas en la propuesta comercial.`;

  const datos_empresa: ContractCompanyData = {
    nombre: empresaNombre,
    tax_id: company.tax_id || '',
    representante: company.representante_legal || creatorName || 'Representante Autorizado',
    email: (company as any).email || '',
    telefono: company.phone || '',
    direccion: company.address || '',
    ciudad_pais: company.address ? company.address.split(',').pop()?.trim() : 'San Salvador',
    logo_url: company.logo_url || null,
    website: company.website || null,
  };

  const datos_cliente: ContractClientData = {
    nombre: clienteNombre,
    empresa: clienteEmpresa,
    tax_id: lead?.tax_id || '',
    email: lead?.email || cotizacion?.email_cliente || '',
    telefono: lead?.phone || cotizacion?.telefono_cliente || '',
    direccion: lead?.address || cotizacion?.direccion_cliente || '',
    cargo: 'Representante Autorizado',
  };

  const formaPagoTexto = cotizacion?.tipo_pago === 'credito'
    ? `Financiado en ${cuotas} cuotas de $${valorCuota.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD con anticipo de $${anticipo.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD.`
    : cotizacion?.monto_anticipo > 0
    ? `Anticipo inicial de $${anticipo.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD y saldo contra entrega.`
    : `Pago de contado por un monto total de $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD.`;

  const clausulas: ContractClause[] = [
    {
      id: 'c1',
      numero: 'PRIMERA',
      titulo: 'OBJETO Y ALCANCE DE LOS SERVICIOS',
      contenido: `EL PRESTADOR se compromete a proveer a favor de EL CLIENTE la ejecución, configuración, entrega y licenciamiento de la solución denominada "${planNombre}"${
        modulos ? `, incluyendo los siguientes componentes: ${modulos}` : ''
      }. Todos los trabajos se realizarán bajo estándares profesionales y de conformidad estricta con las especificaciones acordadas entre ambas partes.`,
      es_personalizada: false,
    },
    {
      id: 'c2',
      numero: 'SEGUNDA',
      titulo: 'HONORARIOS, PRECIO Y FORMA DE PAGO',
      contenido: `Como contraprestación por los servicios objeto de este contrato, EL CLIENTE se obliga a pagar a EL PRESTADOR la suma total de $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD. La modalidad de pago convenida es: ${formaPagoTexto} Todo retraso en los pagos pactados superior a 10 (diez) días naturales devengará un interés moratorio del 2% mensual sobre el saldo adeudado.`,
      es_personalizada: false,
    },
    {
      id: 'c3',
      numero: 'TERCERA',
      titulo: 'PLAZOS DE ENTREGA Y EJECUCIÓN',
      contenido: `EL PRESTADOR iniciará la prestación de los servicios a partir de la firma del presente contrato y la recepción del pago o anticipo pactado. Los entregables se completarán en etapas acordadas de común acuerdo, manteniendo al CLIENTE debidamente informado sobre el avance.`,
      es_personalizada: false,
    },
    {
      id: 'c4',
      numero: 'CUARTA',
      titulo: 'VIGENCIA Y RENOVACIÓN',
      contenido: `El presente contrato tendrá una vigencia obligatoria de ${vigenciaMeses} meses, contados desde ${format(hoy, "d 'de' MMMM 'de' yyyy", { locale: es })} hasta ${format(addMonths(hoy, vigenciaMeses), "d 'de' MMMM 'de' yyyy", { locale: es })}. Se prorrogará automáticamente por períodos iguales a menos que cualquiera de las partes notifique por escrito su intención de no renovarlo con al menos 30 días de anticipación.`,
      es_personalizada: false,
    },
    {
      id: 'c5',
      numero: 'QUINTA',
      titulo: 'OBLIGACIONES DE LAS PARTES',
      contenido: `EL PRESTADOR se obliga a: a) Ejecutar los servicios con la diligencia técnica y profesional debida; b) Brindar soporte técnico y resolución de incidencias en los canales habilitados; c) Mantener confidencialidad de la información. Por su parte, EL CLIENTE se obliga a: a) Suministrar oportunamente la información, accesos o insumos necesarios para la debida prestación; b) Cumplir puntualmente con los pagos acordados; c) Hacer uso legal y autorizado de los servicios provistos.`,
      es_personalizada: false,
    },
    {
      id: 'c6',
      numero: 'SEXTA',
      titulo: 'PROPIEDAD INTELECTUAL Y DERECHOS DE USO',
      contenido: `Todo software, plataforma, arquitectura, metodología o diseño utilizado por EL PRESTADOR continúa siendo propiedad exclusiva de éste o de sus respectivos licenciantes. Se otorga a EL CLIENTE una licencia de uso no transferible y no exclusiva durante la vigencia del contrato para los fines estipulados.`,
      es_personalizada: false,
    },
    {
      id: 'c7',
      numero: 'SÉPTIMA',
      titulo: 'CONFIDENCIALIDAD Y PROTECCIÓN DE DATOS',
      contenido: `Ambas partes acuerdan tratar como confidencial toda información técnica, operativa, comercial o financiera compartida en el marco de este contrato. Esta obligación subsistirá durante la vigencia del contrato y por un período mínimo de tres (3) años posteriores a su terminación.`,
      es_personalizada: false,
    },
    {
      id: 'c8',
      numero: 'OCTAVA',
      titulo: 'CAUSALES DE TERMINACIÓN ANTICIPADA',
      contenido: `Serán causas de terminación justificada sin responsabilidad para la parte cumplida: a) El incumplimiento grave y no subsanado de cualquiera de las cláusulas en un plazo de quince (15) días tras notificación; b) La falta de pago continuada por más de treinta (30) días; c) Acuerdo mutuo por escrito entre las partes.`,
      es_personalizada: false,
    },
    {
      id: 'c9',
      numero: 'NOVENA',
      titulo: 'VALIDEZ JURÍDICA DE LA FIRMA DIGITAL',
      contenido: `Las partes aceptan y reconocen expresamente que la firma mediante mecanismos electrónicos o trazo digital en pantalla, junto con el registro de fecha, hora e identificación telemática (IP y navegador), tiene plena validez jurídica, valor probatorio y fuerza vinculante idéntica a la firma manuscrita.`,
      es_personalizada: false,
    },
    {
      id: 'c10',
      numero: 'DÉCIMA',
      titulo: 'JURISDICCIÓN Y LEGISLACIÓN APLICABLE',
      contenido: `Para la interpretación, cumplimiento o resolución de controversias derivadas del presente contrato, las partes acuerdan intentar resolverlas inicialmente de buena fe mediante conciliación directa. En su defecto, se someten expresamente a la jurisdicción y competencia de los tribunales correspondientes al domicilio legal de EL PRESTADOR.`,
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
    jurisdiccion: datos_empresa.ciudad_pais || 'Jurisdicción del Domicilio del Prestador',
    datos_empresa,
    datos_cliente,
  };
}
