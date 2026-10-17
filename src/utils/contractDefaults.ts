import type { ContractClause, ContractCompanyData, ContractClientData } from '../types/contracts';
import { format, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export type ContractIndustryPreset = 'servicios' | 'suministro' | 'tecnologia' | 'construccion' | 'nda';

export interface IndustryTemplateMeta {
  id: ContractIndustryPreset;
  label: string;
  badge: string;
  icon: string; // identifier for icon
  descripcion: string;
}

export const INDUSTRY_PRESETS: IndustryTemplateMeta[] = [
  {
    id: 'servicios',
    label: 'Servicios Profesionales',
    badge: 'Consultoría & Agencia',
    icon: 'Briefcase',
    descripcion: 'Para agencias, consultores, servicios técnicos, asesorías y prestación de servicios.',
  },
  {
    id: 'suministro',
    label: 'Venta y Suministro',
    badge: 'Comercial & Bienes',
    icon: 'Package',
    descripcion: 'Para empresas comerciales, distribución, venta de productos, materiales y repuestos.',
  },
  {
    id: 'tecnologia',
    label: 'Software & Tecnología',
    badge: 'TI & Licencias SaaS',
    icon: 'Code',
    descripcion: 'Para empresas de software, desarrollo web, aplicaciones, hosting y licenciamiento TI.',
  },
  {
    id: 'construccion',
    label: 'Construcción & Obras',
    badge: 'Obras & Mantenimiento',
    icon: 'Hammer',
    descripcion: 'Para constructoras, reformas, arquitectura, instalaciones y obras civiles.',
  },
  {
    id: 'nda',
    label: 'Confidencialidad (NDA)',
    badge: 'Protección Jurídica',
    icon: 'Shield',
    descripcion: 'Acuerdo bilateral de confidencialidad para resguardar secretos comerciales y proyectos.',
  },
];

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
  cotizacion?: any | null;
  creatorName?: string;
}

export function buildClausesForPreset(
  preset: ContractIndustryPreset,
  params: {
    empresaNombre: string;
    clienteNombre: string;
    clienteEmpresa: string;
    planNombre: string;
    modulos: string;
    total: number;
    formaPagoTexto: string;
    vigenciaMeses: number;
    hoy: Date;
    jurisdiccion: string;
  }
): { title: string; objeto: string; clausulas: ContractClause[] } {
  const {
    clienteEmpresa,
    planNombre,
    modulos,
    total,
    formaPagoTexto,
    vigenciaMeses,
    hoy,
    jurisdiccion,
  } = params;

  const totalStr = total.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const fechaFinDate = addMonths(hoy, vigenciaMeses);
  const fechaFinTexto = format(fechaFinDate, "d 'de' MMMM 'de' yyyy", { locale: es });
  const fechaInicioTexto = format(hoy, "d 'de' MMMM 'de' yyyy", { locale: es });

  switch (preset) {
    case 'suministro': {
      const title = `Contrato Mercantil de Venta y Suministro — ${clienteEmpresa}`;
      const objeto = `Venta, suministro regular y entrega de los bienes, materiales y productos detallados en la propuesta comercial oficial correspondiente a "${planNombre}"${
        modulos ? ` y especificaciones complementarias: ${modulos}` : ''
      }, de conformidad con las calidades y plazos estipulados.`;

      const clausulas: ContractClause[] = [
        {
          id: 'sum-1',
          numero: 'PRIMERA',
          titulo: 'OBJETO DEL SUMINISTRO Y ESPECIFICACIONES TÉCNICAS',
          contenido: `EL PROVEEDOR se obliga a vender, suministrar y entregar a favor de EL COMPRADOR los bienes y productos correspondientes a "${planNombre}"${
            modulos ? `, incluyendo: ${modulos}` : ''
          }. Todos los bienes cumplirán con las normas técnicas de calidad, especificaciones y garantías de fábrica acordadas.`,
        },
        {
          id: 'sum-2',
          numero: 'SEGUNDA',
          titulo: 'PRECIO, CONDICIONES ECONÓMICAS Y FORMA DE PAGO',
          contenido: `El precio total pactado por el suministro asciende a la suma de $${totalStr} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA (USD), pagaderos según las siguientes condiciones: ${formaPagoTexto} El retardo en los pagos facultará al cobro de un interés moratorio del 2% mensual y a la suspensión temporal de despachos.`,
        },
        {
          id: 'sum-3',
          numero: 'TERCERA',
          titulo: 'LUGAR, PLAZO Y MODALIDAD DE ENTREGA',
          contenido: `Las entregas se efectuarán en la dirección acordada entre las partes conforme al cronograma de despachos. Los riesgos sobre los bienes se transferirán a EL COMPRADOR al momento de la entrega material y suscripción de la remisión o guía de entrega correspondiente.`,
        },
        {
          id: 'sum-4',
          numero: 'CUARTA',
          titulo: 'INSPECCIÓN, RECEPCIÓN Y PLAZO DE RECLAMOS',
          contenido: `EL COMPRADOR dispondrá de un plazo de cinco (5) días hábiles posteriores a la recepción para verificar el estado de los bienes. Transcurrido dicho plazo sin reclamo por escrito, los bienes se considerarán aceptados a plena satisfacción.`,
        },
        {
          id: 'sum-5',
          numero: 'QUINTA',
          titulo: 'GARANTÍA DE BIENES Y SUSTITUCIÓN',
          contenido: `EL PROVEEDOR garantiza la calidad y buen estado de los bienes suministrados contra defectos de fabricación por el plazo legal aplicable. En caso de fallas comprobadas atribuibles a fabricación, EL PROVEEDOR sustituirá el bien o reparará el desperfecto en un plazo no mayor a diez (10) días hábiles.`,
        },
        {
          id: 'sum-6',
          numero: 'SEXTA',
          titulo: 'RESERVA DE DOMINIO Y PROPIEDAD',
          contenido: `EL PROVEEDOR conserva el pleno dominio y propiedad de los bienes objeto del presente contrato hasta el pago íntegro y definitivo de la totalidad del precio pactado.`,
        },
        {
          id: 'sum-7',
          numero: 'SÉPTIMA',
          titulo: 'CASO FORTUITO Y FUERZA MAYOR',
          contenido: `Ninguna de las partes será responsable por retrasos o incumplimientos debidos a eventos de fuerza mayor o caso fortuito debidamente comprobados, tales como huelgas portuarias, desastres naturales o restricciones de importación gubernamentales.`,
        },
        {
          id: 'sum-8',
          numero: 'OCTAVA',
          titulo: 'RESOLUCIÓN CONTRACTUAL Y PENALIDADES',
          contenido: `El incumplimiento injustificado en la entrega o en el pago facultará a la parte cumplida a exigir la resolución del contrato con indemnización de daños y perjuicios comprobados, o la exigencia forzosa de la obligación.`,
        },
        {
          id: 'sum-9',
          numero: 'NOVENA',
          titulo: 'VALIDEZ Y EFICACIA DE LA FIRMA ELECTRÓNICA (LEY N° 688)',
          contenido: `Las partes reconocen que la suscripción electrónica del presente contrato por medios telemáticos o pantallas táctiles, junto con su trazabilidad criptográfica SHA-256 e IP, goza de plena validez jurídica, valor probatorio y fuerza ejecutiva conforme a la Ley de Firma Electrónica (Decreto Legislativo N° 688).`,
        },
        {
          id: 'sum-10',
          numero: 'DÉCIMA',
          titulo: 'DOMICILIO CONTRACTUAL, JURISDICCIÓN Y LEY APLICABLE',
          contenido: `Para los efectos legales de este contrato, las partes señalan como domicilio contractual la ciudad de ${jurisdiccion}, sometiéndose a la competencia de sus tribunales mercantiles y a las leyes vigentes aplicables.`,
        },
      ];

      return { title, objeto, clausulas };
    }

    case 'tecnologia': {
      const title = `Contrato de Servicios TI, Desarrollo y Licenciamiento — ${clienteEmpresa}`;
      const objeto = `Servicios de desarrollo de software, licenciamiento tecnológico, infraestructura en la nube y mantenimiento continuo correspondientes a "${planNombre}"${
        modulos ? ` con módulos y funcionalidades de: ${modulos}` : ''
      }, conforme a los estándares de arquitectura y niveles de servicio acordados.`;

      const clausulas: ContractClause[] = [
        {
          id: 'tec-1',
          numero: 'PRIMERA',
          titulo: 'OBJETO, DESARROLLO Y ESPECIFICACIONES TECNOLÓGICAS',
          contenido: `EL PRESTADOR se compromete a proveer los servicios de software, ingeniería de sistemas y licenciamiento tecnológico de "${planNombre}"${
            modulos ? `, integrando los módulos: ${modulos}` : ''
          }. La entrega y puesta en marcha se realizará de conformidad con los requerimientos técnicos y funcionales aprobados.`,
        },
        {
          id: 'tec-2',
          numero: 'SEGUNDA',
          titulo: 'HONORARIOS, LICENCIAMIENTO Y CONDICIONES DE PAGO',
          contenido: `Como contraprestación económica por el software y los servicios técnicos, EL CLIENTE pagará el importe de $${totalStr} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA (USD), bajo la siguiente modalidad: ${formaPagoTexto} La falta oportuna de pago habilitará la suspensión transitoria de los accesos a la plataforma y servicios cloud asociados.`,
        },
        {
          id: 'tec-3',
          numero: 'TERCERA',
          titulo: 'METODOLOGÍA, HITOS Y PRUEBAS DE ACEPTACIÓN (UAT)',
          contenido: `Los entregables de desarrollo serán validados mediante pruebas de aceptación de usuario (UAT). EL CLIENTE dispondrá de siete (7) días hábiles tras cada entrega para reportar observaciones técnicas o manifestar su conformidad por escrito.`,
        },
        {
          id: 'tec-4',
          numero: 'CUARTA',
          titulo: 'NIVELES DE SERVICIO (SLA) Y SOPORTE TÉCNICO',
          contenido: `EL PRESTADOR mantendrá una disponibilidad de la plataforma orientada al 99.5% y proveerá soporte técnico en los horarios estipulados para atender incidentes críticos con tiempos de primera respuesta menores a cuatro (4) horas laborales.`,
        },
        {
          id: 'tec-5',
          numero: 'QUINTA',
          titulo: 'PROPIEDAD INTELECTUAL, CÓDIGO Y DERECHOS DE USO',
          contenido: `Todo código fuente base, librerías, algoritmos y arquitectura previa pertenecen exclusivamente a EL PRESTADOR. Se otorga a EL CLIENTE una licencia de uso corporativa e intransferible durante la vigencia contractual. En ningún caso se transferirá la titularidad sobre la tecnología base salvo acuerdo expreso de cesión.`,
        },
        {
          id: 'tec-6',
          numero: 'SEXTA',
          titulo: 'SEGURIDAD DE LA INFORMACIÓN Y TRATAMIENTO DE DATOS',
          contenido: `EL PRESTADOR implementará medidas técnicas y organizativas adecuadas para proteger los datos de EL CLIENTE contra accesos no autorizados, pérdida accidental o alteración, garantizando la custodia debida y confidencialidad en los servidores utilizados.`,
        },
        {
          id: 'tec-7',
          numero: 'SÉPTIMA',
          titulo: 'CONFIDENCIALIDAD Y SECRETOS EMPRESARIALES',
          contenido: `Ambas partes mantendrán estricta reserva sobre credenciales, bases de datos, lógica de negocios y procesos operativos compartidos. Esta obligación sobrevivirá tres (3) años a la finalización de los servicios.`,
        },
        {
          id: 'tec-8',
          numero: 'OCTAVA',
          titulo: 'GARANTÍA DE SOFTWARE Y CORRECCIÓN DE BUGS',
          contenido: `EL PRESTADOR garantiza el correcto funcionamiento del software conforme a las especificaciones convenidas y corregirá sin costo adicional las fallas imputables a su programación dentro de los sesenta (60) días posteriores al lanzamiento.`,
        },
        {
          id: 'tec-9',
          numero: 'NOVENA',
          titulo: 'VALIDEZ Y EFICACIA DE LA FIRMA ELECTRÓNICA (LEY N° 688)',
          contenido: `Este instrumento firmado mediante tecnología telemática, hash SHA-256 inmutable y registro de fecha/hora goza de plena validez jurídica, fuerza ejecutiva y eficacia vinculante de conformidad con la Ley de Firma Electrónica (Decreto N° 688).`,
        },
        {
          id: 'tec-10',
          numero: 'DÉCIMA',
          titulo: 'DOMICILIO ESPECIAL, JURISDICCIÓN Y LEY APLICABLE',
          contenido: `Para la resolución de divergencias derivadas de este contrato, las partes fijan como domicilio legal la ciudad de ${jurisdiccion}, sometiéndose a la jurisdicción de sus tribunales competentes.`,
        },
      ];

      return { title, objeto, clausulas };
    }

    case 'construccion': {
      const title = `Contrato de Obra Material y Mantenimiento — ${clienteEmpresa}`;
      const objeto = `Ejecución de trabajos de obra material, construcción, adecuaciones físicas y/o mantenimiento civil correspondientes a "${planNombre}"${
        modulos ? ` con alcance en: ${modulos}` : ''
      }, conforme al proyecto técnico y planos aprobados.`;

      const clausulas: ContractClause[] = [
        {
          id: 'con-1',
          numero: 'PRIMERA',
          titulo: 'OBJETO DE LA OBRA Y MEMORIA TÉCNICA',
          contenido: `EL CONTRATISTA se obliga a ejecutar materialmente los trabajos de obra civil, remodelación o mantenimiento de "${planNombre}"${
            modulos ? `, abarcando: ${modulos}` : ''
          }, sujetándose rigurosamente a las especificaciones técnicas, planos y normas de ingeniería aplicables.`,
        },
        {
          id: 'con-2',
          numero: 'SEGUNDA',
          titulo: 'MONTO CONTRACTUAL Y FORMA DE PAGO POR ESTIMACIÓN',
          contenido: `El precio total de la obra convenida es de $${totalStr} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA (USD), que se cancelará conforme a: ${formaPagoTexto} Los pagos por avance se sustentarán en estimaciones aprobadas por la supervisión designada.`,
        },
        {
          id: 'con-3',
          numero: 'TERCERA',
          titulo: 'PLAZO DE EJECUCIÓN Y CRONOGRAMA DE TRABAJO',
          contenido: `EL CONTRATISTA ejecutará la obra en un plazo estimado de ${vigenciaMeses} meses, contados desde la orden de inicio y el pago del anticipo acordado, debiendo ajustarse al cronograma de actividades de obra pactado.`,
        },
        {
          id: 'con-4',
          numero: 'CUARTA',
          titulo: 'CALIDAD DE MATERIALES Y MANO DE OBRA',
          contenido: `Todos los materiales utilizados serán de primera calidad y nuevos. EL CONTRATISTA proveerá personal calificado y herramientas idóneas para garantizar la correcta solidez estructural y acabados de la obra.`,
        },
        {
          id: 'con-5',
          numero: 'QUINTA',
          titulo: 'SEGURIDAD OCUPACIONAL Y RESPONSABILIDAD LABORAL',
          contenido: `EL CONTRATISTA asume total responsabilidad patronal por el personal asignado a la obra, así como la obligación de cumplir las normas de seguridad, higiene ocupacional y dotación de equipos de protección personal (EPP).`,
        },
        {
          id: 'con-6',
          numero: 'SEXTA',
          titulo: 'TRABAJOS EXTRAORDINARIOS Y MODIFICACIONES',
          contenido: `Toda variación sustancial al proyecto o trabajo extraordinario no contemplado en el presupuesto original deberá constar por escrito en orden de cambio suscrita por ambas partes antes de su inicio, definiendo su costo y plazo adicional.`,
        },
        {
          id: 'con-7',
          numero: 'SÉPTIMA',
          titulo: 'RECEPCIÓN PROVISIONAL Y RECEPCIÓN DEFINITIVA',
          contenido: `Al finalizar los trabajos se suscribirá un Acta de Recepción Provisional. Tras subsanar observaciones en un plazo de quince (15) días hábiles, se levantará el Acta de Recepción Definitiva y Finiquito correspondiente.`,
        },
        {
          id: 'con-8',
          numero: 'OCTAVA',
          titulo: 'GARANTÍA DE BUENA OBRA Y VICIOS OCULTOS',
          contenido: `EL CONTRATISTA responde por la solidez de la obra y vicios ocultos de construcción durante el plazo de ley, obligándose a reparar a su exclusivo costo cualquier deficiencia imputable a fallas constructivas o de materiales.`,
        },
        {
          id: 'con-9',
          numero: 'NOVENA',
          titulo: 'VALIDEZ Y EFICACIA DE LA FIRMA ELECTRÓNICA (LEY N° 688)',
          contenido: `Las partes otorgan pleno valor probatorio y fuerza ejecutiva a la firma electrónica del presente contrato de conformidad con la Ley de Firma Electrónica (Decreto N° 688), respaldado por auditoría criptográfica inmutable.`,
        },
        {
          id: 'con-10',
          numero: 'DÉCIMA',
          titulo: 'DOMICILIO CONTRACTUAL Y TRIBUNALES COMPETENTES',
          contenido: `Para todos los efectos legales y controversias judiciales, las partes fijan su domicilio contractual en la ciudad de ${jurisdiccion}, a cuyos jueces y tribunales competentes se someten expresamente.`,
        },
      ];

      return { title, objeto, clausulas };
    }

    case 'nda': {
      const title = `Acuerdo Bilateral de Confidencialidad y No Divulgación — ${clienteEmpresa}`;
      const objeto = `Establecer los términos de reserva, sigilo comercial y custodia estricta de la información técnica, financiera, estratégica y de negocios compartida entre las partes con ocasión del proyecto "${planNombre}".`;

      const clausulas: ContractClause[] = [
        {
          id: 'nda-1',
          numero: 'PRIMERA',
          titulo: 'PROPÓSITO Y ÁMBITO DE LA DIVULGACIÓN',
          contenido: `Las partes intercambiarán información con el exclusivo propósito de evaluar, coordinar y ejecutar posibles sinergias comerciales o proyectos vinculados a "${planNombre}". La información no será utilizada para ningún fin ajeno al autorizado.`,
        },
        {
          id: 'nda-2',
          numero: 'SEGUNDA',
          titulo: 'DEFINICIÓN DE INFORMACIÓN CONFIDENCIAL',
          contenido: `Se considera Información Confidencial toda información técnica, fórmulas, metodologías, bases de datos, estados financieros, precios, estrategias de mercadeo, software o secretos comerciales transmitidos de forma oral, física o digital entre las partes.`,
        },
        {
          id: 'nda-3',
          numero: 'TERCERA',
          titulo: 'EXCLUSIONES DEL DEBER DE CONFIDENCIALIDAD',
          contenido: `No se considerará Información Confidencial aquella que: a) Sea de dominio público sin mediar infracción del presente acuerdo; b) Hubiere sido conocida con anterioridad legítimamente; c) Sea requerida por orden judicial o autoridad gubernamental competente.`,
        },
        {
          id: 'nda-4',
          numero: 'CUARTA',
          titulo: 'OBLIGACIONES DE CUSTODIA Y NO DIVULGACIÓN',
          contenido: `La parte receptora se compromete a proteger la Información Confidencial con el mismo celo que destina a su propia información de similar naturaleza y a no revelarla a terceros sin autorización previa y escrita de la parte emisora.`,
        },
        {
          id: 'nda-5',
          numero: 'QUINTA',
          titulo: 'PROPIEDAD DE LA INFORMACIÓN Y AUSENCIA DE LICENCIA',
          contenido: `Toda la Información Confidencial permanece bajo propiedad exclusiva de la parte emisora. La divulgación de datos no confiere expresa ni tácitamente ninguna licencia, patente ni derecho de autor sobre la misma.`,
        },
        {
          id: 'nda-6',
          numero: 'SEXTA',
          titulo: 'RESTITUCIÓN O DESTRUCCIÓN DE INFORMACIÓN',
          contenido: `A la solicitud de la parte emisora, o a la terminación de las conversaciones, la receptora restituirá o destruirá fehacientemente toda copia física o digital de la Información Confidencial en su poder en un plazo de cinco (5) días hábiles.`,
        },
        {
          id: 'nda-7',
          numero: 'SÉPTIMA',
          titulo: 'VIGENCIA DEL DEBER DE SECRETO',
          contenido: `Las obligaciones de secreto y custodia establecidas en este acuerdo permanecerán vigentes durante las conversaciones y por un período ininterrumpido de tres (3) años posteriores a su suscripción.`,
        },
        {
          id: 'nda-8',
          numero: 'OCTAVA',
          titulo: 'INDEMNIZACIÓN POR DIVULGACIÓN INDEBIDA',
          contenido: `Cualquier infracción a las estipulaciones de confidencialidad facultará a la parte afectada a iniciar acciones cautelares inmediatas y a exigir el resarcimiento integral de los daños y perjuicios económicos o reputacionales ocasionados.`,
        },
        {
          id: 'nda-9',
          numero: 'NOVENA',
          titulo: 'VALIDEZ Y EFICACIA DE LA FIRMA ELECTRÓNICA (LEY N° 688)',
          contenido: `El presente acuerdo suscrito digitalmente cuenta con plena validez probatoria y vinculación jurídica de conformidad con las disposiciones de la Ley de Firma Electrónica (Decreto Legislativo N° 688).`,
        },
        {
          id: 'nda-10',
          numero: 'DÉCIMA',
          titulo: 'DOMICILIO ESPECIAL, JURISDICCIÓN Y LEY APLICABLE',
          contenido: `Las partes fijan como domicilio legal para la resolución de cualquier discrepancia la ciudad de ${jurisdiccion}, renunciando a otros fueros y sometiéndose a sus tribunales comunes.`,
        },
      ];

      return { title, objeto, clausulas };
    }

    // Default: Servicios Profesionales & Consultoría
    case 'servicios':
    default: {
      const title = `Contrato de Prestación de Servicios — ${clienteEmpresa}`;
      const objeto = `Prestación de servicios profesionales integrales y licenciamiento correspondientes a "${planNombre}"${
        modulos ? ` con módulos y alcance adicional en: ${modulos}` : ''
      }, conforme a las especificaciones acordadas en la propuesta comercial oficial.`;

      const clausulas: ContractClause[] = [
        {
          id: 'c1',
          numero: 'PRIMERA',
          titulo: 'OBJETO Y ALCANCE DE LOS SERVICIOS',
          contenido: `EL PRESTADOR se compromete y obliga a prestar a favor de EL CLIENTE los servicios profesionales, técnicos y de licenciamiento correspondientes a "${planNombre}"${
            modulos ? `, integrando los siguientes módulos y alcances: ${modulos}` : ''
          }. Todos los trabajos se realizarán bajo los más rigurosos estándares profesionales y de estricta conformidad con las especificaciones acordadas en la propuesta comercial oficial.`,
        },
        {
          id: 'c2',
          numero: 'SEGUNDA',
          titulo: 'PRECIO, CONDICIONES ECONÓMICAS Y FORMA DE PAGO',
          contenido: `Como contraprestación por los servicios objeto del presente contrato, EL CLIENTE se obliga a pagar a EL PRESTADOR la suma total de $${totalStr} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA (USD), moneda de curso legal en la República de El Salvador. La modalidad y condiciones de pago acordadas son las siguientes: ${formaPagoTexto} Todo retraso en los pagos pactados superior a diez (10) días naturales devengará un interés moratorio legal del 2% mensual sobre saldos insolutos, reconociéndose a este contrato fuerza ejecutiva mercantil de conformidad con la ley salvadoreña.`,
        },
        {
          id: 'c3',
          numero: 'TERCERA',
          titulo: 'PLAZOS DE ENTREGA Y EJECUCIÓN',
          contenido: `EL PRESTADOR iniciará la prestación de los servicios a partir de la suscripción del presente instrumento y de la confirmación del anticipo o pago convenido. Los avances y entregables se desarrollarán de conformidad con el cronograma acordado de mutuo consentimiento entre las partes.`,
        },
        {
          id: 'c4',
          numero: 'CUARTA',
          titulo: 'VIGENCIA Y RENOVACIÓN CONTRACTUAL',
          contenido: `El presente contrato tendrá una vigencia obligatoria de ${vigenciaMeses} meses calendario, contados a partir del ${fechaInicioTexto} hasta el ${fechaFinTexto}. Se prorrogará automáticamente por períodos iguales a menos que cualquiera de las partes notifique por escrito su intención de no renovarlo con al menos treinta (30) días de anticipación al vencimiento.`,
        },
        {
          id: 'c5',
          numero: 'QUINTA',
          titulo: 'OBLIGACIONES Y RESPONSABILIDADES DE LAS PARTES',
          contenido: `Son obligaciones de EL PRESTADOR: a) Ejecutar los servicios con la diligencia técnica y profesional debida; b) Brindar soporte técnico y resolución de incidencias en los canales habilitados; c) Mantener absoluta reserva y confidencialidad. Son obligaciones de EL CLIENTE: a) Suministrar oportunamente la información, accesos o insumos necesarios para la debida prestación; b) Cumplir puntualmente con los pagos convenidos; c) Hacer uso legal, lícito y autorizado de los servicios provistos.`,
        },
        {
          id: 'c6',
          numero: 'SEXTA',
          titulo: 'PROPIEDAD INTELECTUAL Y DERECHOS DE USO',
          contenido: `Todo software, plataforma, arquitectura, metodología, código o diseño utilizado o desarrollado por EL PRESTADOR continúa siendo de su propiedad exclusiva o de sus respectivos licenciantes conforme a la Ley de Propiedad Intelectual de la República de El Salvador. Se otorga a EL CLIENTE una licencia de uso corporativa, intransferible y no exclusiva durante la vigencia del contrato para los fines estipulados.`,
        },
        {
          id: 'c7',
          numero: 'SÉPTIMA',
          titulo: 'CONFIDENCIALIDAD Y PROTECCIÓN DE DATOS',
          contenido: `Ambas partes acuerdan tratar como información confidencial toda información técnica, operativa, comercial o financiera compartida en el marco de este contrato. Esta obligación de secreto y no divulgación permanecerá vigente durante la vigencia del contrato y por un período mínimo de tres (3) años posteriores a su terminación por cualquier causa.`,
        },
        {
          id: 'c8',
          numero: 'OCTAVA',
          titulo: 'CAUSALES DE RESOLUCIÓN Y TERMINACIÓN ANTICIPADA',
          contenido: `Serán causas de terminación justificada sin responsabilidad para la parte cumplida: a) El incumplimiento grave de cualquiera de las cláusulas no subsanado en un plazo de quince (15) días hábiles tras notificación escrita; b) La falta de pago continuada por más de treinta (30) días; c) Acuerdo mutuo formalizado por escrito entre las partes.`,
        },
        {
          id: 'c9',
          numero: 'NOVENA',
          titulo: 'VALIDEZ Y EFICACIA JURÍDICA DE LA FIRMA ELECTRÓNICA (LEY N° 688)',
          contenido: `De conformidad con lo dispuesto en la Ley de Firma Electrónica de la República de El Salvador (Decreto Legislativo N° 688) y su Reglamento, las partes reconocen y aceptan de manera expresa que la firma electrónica o digital consignada en este documento por medios telemáticos o pantallas táctiles, junto con el registro inmutable de fecha, hora, dirección IP y hash criptográfico de auditoría, goza de plena validez jurídica, valor probatorio y fuerza ejecutiva vinculante idéntica a la firma autógrafa manuscrita.`,
        },
        {
          id: 'c10',
          numero: 'DÉCIMA',
          titulo: 'DOMICILIO ESPECIAL, JURISDICCIÓN Y LEY APLICABLE',
          contenido: `Para todos los efectos legales, judiciales o extrajudiciales que se deriven del presente contrato, ambas partes señalan de común acuerdo como domicilio especial la ciudad de ${jurisdiccion}, a cuyos tribunales y jueces competentes se someten expresamente en caso de controversia, renunciando al fuero de sus domicilios particulares conforme a las disposiciones del Código Procesal Civil y Mercantil de El Salvador.`,
        },
      ];

      return { title, objeto, clausulas };
    }
  }
}

export function generateContractDefaults(
  seed: ContractSeedData,
  preset: ContractIndustryPreset = 'servicios'
): {
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

  const jurisdiccion = datos_empresa.ciudad_pais || 'San Salvador, El Salvador';

  const { title, objeto, clausulas } = buildClausesForPreset(preset, {
    empresaNombre,
    clienteNombre,
    clienteEmpresa,
    planNombre,
    modulos,
    total,
    formaPagoTexto,
    vigenciaMeses,
    hoy,
    jurisdiccion,
  });

  return {
    contract_number,
    title,
    objeto,
    clausulas,
    monto_total: total,
    forma_pago: formaPagoTexto,
    anticipo,
    cuotas,
    valor_cuota: valorCuota,
    vigencia_meses: vigenciaMeses,
    fecha_inicio: fechaInicioStr,
    fecha_fin: fechaFinStr,
    jurisdiccion,
    datos_empresa,
    datos_cliente,
  };
}
