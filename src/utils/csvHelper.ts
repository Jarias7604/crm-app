// CSV Template v3.0 - Updated 2026-01-21 - All roles use same headers
import { PRIORITY_CONFIG, SOURCE_CONFIG } from '../types';

export const CSV_COLUMNS = [
    { key: 'name', label: 'Nombre completo' },
    { key: 'company_name', label: 'Empresa (opcional)' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'address', label: 'Dirección' },
    { key: 'source', label: 'Fuente' },
    { key: 'priority', label: 'Prioridad' },
    { key: 'status', label: 'Estado' },
    { key: 'value', label: 'Valor' },
    { key: 'next_action_notes', label: 'Notas Iniciales' },
    { key: 'created_at', label: 'Fecha de Creación' },
    { key: 'closing_amount', label: 'Monto Cierre' },
    { key: 'assigned_to', label: 'Asignado a' },
    { key: 'next_followup_date', label: 'Próximo Seguimiento' },
    { key: 'next_followup_assignee', label: 'Responsable Seguimiento' }
];

export const csvHelper = {
    generateTemplate() {
        const headers = CSV_COLUMNS.map(col => col.label).join(',');

        // Add instruction row with examples
        const instructionRow = [
            'Juan Pérez',  // name (REQUERIDO)
            'Empresa A.C.',  // company_name (opcional)
            'juan@ejemplo.com',  // email
            '+50312345678',  // phone (formato internacional con código de país)
            'Calle Falsa 123, San Salvador', // address
            'Redes Sociales',  // source
            'Alta',  // priority (Alta, Media, Baja)
            'Prospecto',  // status
            '1000',  // value
            'Contacto inicial por Facebook',  // notes
            '15-01-2026',  // created_at (formato DD-MM-YYYY)
            '5000', // closing_amount
            'vendedor@empresa.com', // assigned_to
            '20-01-2026', // next_followup_date
            'vendedor@empresa.com' // next_followup_assignee
        ].join(',');

        const csvContent = `${headers}\n${instructionRow}`;
        // Use BOM for Excel encoding compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', 'plantilla_importacion_leads.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    generateExcelTemplate() {
        // @ts-ignore - xlsx is dynamically imported
        import('xlsx').then((XLSX) => {
            // Create workbook
            const wb = XLSX.utils.book_new();

            // Sheet 1: Template with headers and example
            const headers = CSV_COLUMNS.map(col => col.label);
            const exampleRow = [
                'Juan Pérez',
                'Empresa A.C.',
                'juan@ejemplo.com',
                '+50312345678',
                'Calle Falsa 123, San Salvador',
                'Redes Sociales',
                'Alta',
                'Prospecto',
                '1000',
                'Contacto inicial por Facebook',
                '15-01-2026',
                '5000',
                'vendedor@empresa.com',
                '20-01-2026',
                'vendedor@empresa.com'
            ];

            const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);

            // Set column widths for better readability
            const colWidths = [
                { wch: 20 }, // Nombre completo
                { wch: 20 }, // Empresa
                { wch: 25 }, // Email
                { wch: 15 }, // Teléfono
                { wch: 30 }, // Dirección
                { wch: 18 }, // Fuente
                { wch: 12 }, // Prioridad
                { wch: 18 }, // Estado
                { wch: 10 }, // Valor
                { wch: 35 }, // Notas
                { wch: 18 }, // Fecha Creación
                { wch: 15 }, // Monto Cierre
                { wch: 25 }, // Asignado a
                { wch: 20 }, // Próximo Seguimiento
                { wch: 25 }  // Responsable Seguimiento
            ];
            ws['!cols'] = colWidths;

            // Style header row (row 1)
            const headerStyle = {
                fill: { fgColor: { rgb: "4472C4" } },
                font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
                alignment: { horizontal: "center", vertical: "center" }
            };

            // Style example row (row 2)
            const exampleStyle = {
                fill: { fgColor: { rgb: "E7E6E6" } },
                font: { italic: true, sz: 10 },
                alignment: { horizontal: "left", vertical: "center" }
            };

            // Apply styles to header cells
            headers.forEach((_, idx) => {
                const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
                if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headers[idx] };
                ws[cellRef].s = headerStyle;
            });

            // Apply styles to example cells
            exampleRow.forEach((val, idx) => {
                const cellRef = XLSX.utils.encode_cell({ r: 1, c: idx });
                if (!ws[cellRef]) ws[cellRef] = { t: 's', v: val };
                ws[cellRef].s = exampleStyle;
            });

            XLSX.utils.book_append_sheet(wb, ws, 'Leads');

            // Sheet 2: Instructions
            const instructions = [
                ['📋 INSTRUCCIONES DE IMPORTACIÓN DE LEADS'],
                [''],
                ['1️⃣ CAMPOS OBLIGATORIOS'],
                ['   • Nombre completo: Requerido'],
                ['   • Email: Requerido y debe ser válido'],
                [''],
                ['2️⃣ FORMATOS IMPORTANTES'],
                ['   • Teléfono: +50312345678 (con código de país)'],
                ['   • Fechas: DD-MM-YYYY (ejemplo: 15-01-2026)'],
                ['   • Prioridad: Alta, Media, Baja'],
                ['   • Estado: Prospecto, Lead calificado, En seguimiento, Negociación, Cliente, Cerrado'],
                ['   • Fuente: Redes Sociales, Referidos, Visita Campo, Sitio Web, Llamada Fría, Otro'],
                [''],
                ['3️⃣ VALORES NUMÉRICOS'],
                ['   • Valor: Número sin símbolos (ejemplo: 1000)'],
                ['   • Monto Cierre: Número sin símbolos (ejemplo: 5000)'],
                [''],
                ['4️⃣ ASIGNACIÓN'],
                ['   • Asignado a: Email del vendedor'],
                ['   • Responsable Seguimiento: Email del responsable'],
                [''],
                ['5️⃣ PROCESO DE IMPORTACIÓN'],
                ['   • Complete los datos en la hoja "Leads"'],
                ['   • Puede eliminar la fila de ejemplo'],
                ['   • Guarde el archivo (Excel o CSV)'],
                ['   • En el CRM, use el botón "Importar"'],
                ['   • Seleccione el archivo guardado'],
                [''],
                ['⚠️ NOTAS IMPORTANTES'],
                ['   • No modifique los nombres de las columnas'],
                ['   • Puede dejar campos opcionales vacíos'],
                ['   • El teléfono se formateará automáticamente'],
                ['   • Las fechas deben seguir el formato DD-MM-YYYY']
            ];

            const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);

            // Style instructions sheet
            wsInstructions['!cols'] = [{ wch: 80 }];

            // Style title
            const titleCell = 'A1';
            if (wsInstructions[titleCell]) {
                wsInstructions[titleCell].s = {
                    font: { bold: true, sz: 14, color: { rgb: "1F4E78" } },
                    alignment: { horizontal: "left", vertical: "center" }
                };
            }

            XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones');

            // Download file
            XLSX.writeFile(wb, 'plantilla_importacion_leads.xlsx');
        }).catch(err => {
            console.error('Error generating Excel template:', err);
            // Fallback to CSV if Excel fails
            this.generateTemplate();
        });
    },

    parse(file: File, teamMembers: any[] = []): Promise<any[]> {
        return new Promise(async (resolve, reject) => {
            try {
                // Check file extension
                const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

                if (isExcel) {
                    // Parse Excel file
                    const XLSX = await import('xlsx');
                    const arrayBuffer = await file.arrayBuffer();
                    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

                    // Get first sheet
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    // Convert to JSON (array of objects)
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                    if (jsonData.length < 2) {
                        resolve([]);
                        return;
                    }

                    // First row is headers
                    const rawHeaders = (jsonData[0] as any[]).map(h => String(h).trim().toLowerCase());

                    // Process data rows (skip header)
                    const data = (jsonData.slice(1) as any[][])
                        .map(row => {
                            const lead: any = {};
                            let hasName = false;

                            CSV_COLUMNS.forEach((col) => {
                                const possibleHeaders = [
                                    col.label.toLowerCase(),
                                    col.key.toLowerCase(),
                                    col.label.split('(')[0].trim().toLowerCase(),
                                    col.label.split(' ')[0].toLowerCase()
                                ];

                                const headerIndex = rawHeaders.findIndex(h => possibleHeaders.includes(h));

                                if (headerIndex !== -1 && headerIndex < row.length) {
                                    let val: any = row[headerIndex];

                                    // Skip empty values
                                    if (val === null || val === undefined || val === '') return;

                                    // Convert to string for processing
                                    val = String(val).trim();

                                    // Apply same transformations as CSV parser
                                    if (col.key === 'status' && val) {
                                        const statusMap: Record<string, string> = {
                                            'prospecto': 'Prospecto',
                                            'calificado': 'Lead calificado', 'lead calificado': 'Lead calificado',
                                            'sin respuesta': 'Prospecto',
                                            'frio': 'Prospecto', 'frío': 'Prospecto', 'lead frío': 'Prospecto',
                                            'contactado': 'En seguimiento',
                                            'cotizacion': 'Negociación', 'cotización': 'Negociación', 'cotización enviada': 'Negociación',
                                            'negociacion': 'Negociación', 'negociación': 'Negociación', 'seguimiento': 'En seguimiento', 'seguimiento / negociación': 'Negociación',
                                            'cerrado': 'Cerrado',
                                            'cliente': 'Cliente',
                                            'perdido': 'Prospecto',
                                            'en seguimiento': 'En seguimiento',
                                            'nuevo lead': 'Prospecto', 'nuevo': 'Prospecto',
                                            'potencial – en seguimiento': 'En seguimiento',
                                            'cliente 2025': 'Cliente', 'cliente 2026': 'Cliente',
                                            'lead perdido': 'Prospecto', 'lead erroneo': 'Prospecto', 'lead erróneo': 'Prospecto'
                                        };
                                        const normalizedVal = val.toLowerCase().trim();
                                        val = statusMap[normalizedVal] || val;
                                    }

                                    if (col.key === 'priority' && val) {
                                        const priorityMap: Record<string, string> = {
                                            'muy alta': 'very_high', 'altisima': 'very_high', 'altísima': 'very_high', 'urgente': 'very_high',
                                            'alta': 'high', 'media': 'medium', 'baja': 'low'
                                        };
                                        const normalizedVal = val.split('(')[0].trim().toLowerCase();
                                        val = priorityMap[normalizedVal] || val;
                                    }

                                    if (col.key === 'source' && val) {
                                        const sourceMap: Record<string, string> = {
                                            'redes sociales': 'redes_sociales', 'referidos': 'referidos', 'visita campo': 'visita_campo',
                                            'sitio web': 'sitio_web', 'llamada fria': 'llamada_fria', 'llamada fría': 'llamada_fria', 'otro': 'otro'
                                        };
                                        const normalizedVal = val.split('(')[0].trim().toLowerCase();
                                        val = sourceMap[normalizedVal] || val;
                                    }

                                    if (col.key === 'value') {
                                        val = parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
                                    }

                                    if (col.key === 'phone' && val) {
                                        let cleanNumber = String(val).replace(/\D/g, '');
                                        if (cleanNumber.length === 8) {
                                            cleanNumber = '503' + cleanNumber;
                                        }
                                        if (cleanNumber.length >= 8) {
                                            val = '+' + cleanNumber;
                                        } else {
                                            val = cleanNumber;
                                        }
                                    }

                                    // Map Spanish status names for robust import
                                    if (col.key === 'status' && val) {
                                        const statusMap: Record<string, string> = {
                                            'prospecto': 'Prospecto',
                                            'calificado': 'Lead calificado', 'lead calificado': 'Lead calificado',
                                            'sin respuesta': 'Prospecto',
                                            'frio': 'Prospecto', 'frío': 'Prospecto', 'lead frío': 'Prospecto',
                                            'contactado': 'En seguimiento',
                                            'cotizacion': 'Negociación', 'cotización': 'Negociación', 'cotización enviada': 'Negociación',
                                            'negociacion': 'Negociación', 'negociación': 'Negociación', 'seguimiento': 'En seguimiento', 'seguimiento / negociación': 'Negociación',
                                            'cerrado': 'Cerrado',
                                            'cliente': 'Cliente',
                                            'perdido': 'Prospecto',
                                            'en seguimiento': 'En seguimiento',
                                            'nuevo lead': 'Prospecto', 'nuevo': 'Prospecto',
                                            'potencial – en seguimiento': 'En seguimiento',
                                            'cliente 2025': 'Cliente', 'cliente 2026': 'Cliente',
                                            'lead perdido': 'Prospecto', 'lead erroneo': 'Prospecto', 'lead erróneo': 'Prospecto'
                                        };
                                        const normalizedVal = String(val).toLowerCase().trim();
                                        val = statusMap[normalizedVal] || val;
                                    }

                                    // Map Spanish priority names
                                    if (col.key === 'priority' && val) {
                                        const priorityMap: Record<string, string> = {
                                            'muy alta': 'very_high', 'altisima': 'very_high', 'altísima': 'very_high', 'urgente': 'very_high',
                                            'alta': 'high', 'media': 'medium', 'baja': 'low'
                                        };
                                        const normalizedVal = String(val).split('(')[0].trim().toLowerCase();
                                        val = priorityMap[normalizedVal] || val;
                                    }

                                    // Map Spanish source names
                                    if (col.key === 'source' && val) {
                                        const sourceMap: Record<string, string> = {
                                            'redes sociales': 'redes_sociales', 'referidos': 'referidos', 'visita campo': 'visita_campo',
                                            'sitio web': 'sitio_web', 'llamada fria': 'llamada_fria', 'llamada fría': 'llamada_fria', 'otro': 'otro'
                                        };
                                        const normalizedVal = String(val).split('(')[0].trim().toLowerCase();
                                        val = sourceMap[normalizedVal] || val;
                                    }

                                    // Convert email to UUID for assignment fields
                                    if ((col.key === 'assigned_to' || col.key === 'next_followup_assignee') && val) {
                                        const member = teamMembers.find(m =>
                                            m.email?.toLowerCase() === String(val).toLowerCase().trim() ||
                                            m.full_name?.toLowerCase() === String(val).toLowerCase().trim()
                                        );
                                        if (member) {
                                            val = member.id;
                                        } else {
                                            // If no match found, set to null to avoid UUID error
                                            val = undefined;
                                        }
                                    }

                                    // Parse dates (DD-MM-YYYY or DD/MM/YYYY format)
                                    if ((col.key === 'created_at' || col.key === 'next_followup_date') && val) {
                                        const cleanDate = String(val).split('(')[0].trim();
                                        const match = cleanDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
                                        if (match) {
                                            const day = match[1].padStart(2, '0');
                                            const month = match[2].padStart(2, '0');
                                            const year = match[3];
                                            const dateObj = new Date(`${year}-${month}-${day}T12:00:00Z`);
                                            if (!isNaN(dateObj.getTime())) val = dateObj.toISOString();
                                            else val = undefined;
                                        } else val = undefined;
                                    }

                                    if (val !== undefined && val !== '') {
                                        lead[col.key] = val;
                                        if (col.key === 'name') hasName = true;
                                    }
                                }
                            });

                            return hasName ? lead : null;
                        })
                        .filter(l => l !== null);

                    resolve(data);
                } else {
                    // Parse CSV file (existing logic)
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const text = e.target?.result as string;
                            if (!text) {
                                resolve([]);
                                return;
                            }

                            // Handle different line endings and filter out empty lines
                            const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
                            if (lines.length < 2) {
                                resolve([]);
                                return;
                            }

                            // Detect delimiter (comma or semicolon)
                            const firstLine = lines[0];
                            const commaCount = (firstLine.match(/,/g) || []).length;
                            const semicolonCount = (firstLine.match(/;/g) || []).length;
                            const delimiter = semicolonCount > commaCount ? ';' : ',';

                            // Process headers: normalize for robust matching
                            const rawHeaders = lines[0].split(delimiter).map(h => h.trim().replace(/^[\uFEFF]/, '').toLowerCase());

                            const data = lines.slice(1)
                                .map(row => {
                                    // Robust CSV split that respects quotes - handles both , and ;
                                    const regex = new RegExp(`(${delimiter}|\\r?\\n|^)(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}\\r\\n]*))`, 'gi');
                                    const values: string[] = [];
                                    let match;
                                    while (match = regex.exec(row)) {
                                        let val = match[2] !== undefined ? match[2].replace(/""/g, '"') : match[3];
                                        values.push((val || '').trim());
                                    }

                                    const lead: any = {};
                                    let hasName = false;

                                    CSV_COLUMNS.forEach((col) => {
                                        // Find header index by checking multiple possible matches (Spanish, English, or exact match)
                                        const possibleHeaders = [
                                            col.label.toLowerCase(),
                                            col.key.toLowerCase(),
                                            col.label.split('(')[0].trim().toLowerCase(), // e.g., "Empresa" for "Empresa (opcional)"
                                            col.label.split(' ')[0].toLowerCase() // e.g., "Nombre" for "Nombre completo"
                                        ];

                                        const headerIndex = rawHeaders.findIndex(h => possibleHeaders.includes(h));

                                        if (headerIndex !== -1 && headerIndex < values.length) {
                                            let val: any = values[headerIndex];

                                            // Map Spanish status names for robust import
                                            if (col.key === 'status' && val) {
                                                const statusMap: Record<string, string> = {
                                                    'prospecto': 'Prospecto',
                                                    'calificado': 'Lead calificado', 'lead calificado': 'Lead calificado',
                                                    'sin respuesta': 'Prospecto',
                                                    'frio': 'Prospecto', 'frío': 'Prospecto', 'lead frío': 'Prospecto',
                                                    'contactado': 'En seguimiento',
                                                    'cotizacion': 'Negociación', 'cotización': 'Negociación', 'cotización enviada': 'Negociación',
                                                    'negociacion': 'Negociación', 'negociación': 'Negociación', 'seguimiento': 'En seguimiento', 'seguimiento / negociación': 'Negociación',
                                                    'cerrado': 'Cerrado',
                                                    'cliente': 'Cliente',
                                                    'perdido': 'Prospecto',
                                                    'en seguimiento': 'En seguimiento',
                                                    // Mapping from old statuses
                                                    'nuevo lead': 'Prospecto', 'nuevo': 'Prospecto',
                                                    'potencial – en seguimiento': 'En seguimiento',
                                                    'cliente 2025': 'Cliente', 'cliente 2026': 'Cliente',
                                                    'lead perdido': 'Prospecto', 'lead erroneo': 'Prospecto', 'lead erróneo': 'Prospecto'
                                                };
                                                const normalizedVal = val.toLowerCase().trim();
                                                val = statusMap[normalizedVal] || val;
                                            }

                                            // Map Spanish priority names
                                            if (col.key === 'priority' && val) {
                                                const priorityMap: Record<string, string> = {
                                                    'muy alta': 'very_high', 'altisima': 'very_high', 'altísima': 'very_high', 'urgente': 'very_high',
                                                    'alta': 'high', 'media': 'medium', 'baja': 'low'
                                                };
                                                const normalizedVal = val.split('(')[0].trim().toLowerCase();
                                                val = priorityMap[normalizedVal] || val;
                                            }

                                            // Map Spanish source names
                                            if (col.key === 'source' && val) {
                                                const sourceMap: Record<string, string> = {
                                                    'redes sociales': 'redes_sociales', 'referidos': 'referidos', 'visita campo': 'visita_campo',
                                                    'sitio web': 'sitio_web', 'llamada fria': 'llamada_fria', 'llamada fría': 'llamada_fria', 'otro': 'otro'
                                                };
                                                const normalizedVal = val.split('(')[0].trim().toLowerCase();
                                                val = sourceMap[normalizedVal] || val;
                                            }

                                            // Parse value as number
                                            if (col.key === 'value') {
                                                val = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
                                            }

                                            // Parse and format Phone Number
                                            if (col.key === 'phone' && val) {
                                                // Remove all non-numeric characters
                                                let cleanNumber = val.replace(/\D/g, '');

                                                // Specific logic for El Salvador (8 digits -> add 503)
                                                // This is a common requirement for the user's region
                                                if (cleanNumber.length === 8) {
                                                    cleanNumber = '503' + cleanNumber;
                                                }

                                                // Ensure it has + prefix if it looks like a full number
                                                if (cleanNumber.length >= 8) {
                                                    val = '+' + cleanNumber;
                                                } else {
                                                    val = cleanNumber; // Keep as is if too short
                                                }
                                            }

                                            // Convert email to UUID for assignment fields
                                            if ((col.key === 'assigned_to' || col.key === 'next_followup_assignee') && val) {
                                                const member = teamMembers.find(m =>
                                                    m.email?.toLowerCase() === val.toLowerCase().trim() ||
                                                    m.full_name?.toLowerCase() === val.toLowerCase().trim()
                                                );
                                                if (member) {
                                                    val = member.id;
                                                } else {
                                                    // If no match found, set to null to avoid UUID error
                                                    val = undefined;
                                                }
                                            }

                                            // Parse dates (DD-MM-YYYY or DD/MM/YYYY format)
                                            if ((col.key === 'created_at' || col.key === 'next_followup_date') && val) {
                                                const cleanDate = val.split('(')[0].trim();
                                                // Support both - and / as delimiters
                                                const match = cleanDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
                                                if (match) {
                                                    const day = match[1].padStart(2, '0');
                                                    const month = match[2].padStart(2, '0');
                                                    const year = match[3];
                                                    // Ensure ISO format YYYY-MM-DD
                                                    const dateObj = new Date(`${year}-${month}-${day}T12:00:00Z`);
                                                    if (!isNaN(dateObj.getTime())) val = dateObj.toISOString();
                                                    else val = undefined;
                                                } else val = undefined;
                                            }

                                            if (val !== undefined && val !== '') {
                                                lead[col.key] = val;
                                                if (col.key === 'name') hasName = true;
                                            }
                                        }
                                    });

                                    return hasName ? lead : null;
                                })
                                .filter(l => l !== null); // Remove rows without a name

                            resolve(data);
                        } catch (error) {
                            reject(error);
                        }
                    };
                    reader.onerror = (err) => reject(err);
                    reader.readAsText(file);
                }
            } catch (error) {
                reject(error);
            }
        });
    },

    exportLeads(leads: any[], teamMembers: any[] = [], filename = 'leads_export.csv') {
        const rows = leads.map(lead => {
            return CSV_COLUMNS.map(col => {
                let value = lead[col.key];

                // Resolve Assigner Name from ID
                if ((col.key === 'assigned_to' || col.key === 'next_followup_assignee') && value) {
                    const member = teamMembers.find(m => m.id === value);
                    value = member ? (member.full_name || member.email) : value; // Fallback to ID if not found
                }

                // Map Priority Internal -> Label
                if (col.key === 'priority' && value) {
                    const config = PRIORITY_CONFIG[value as keyof typeof PRIORITY_CONFIG];
                    if (config) value = config.label;
                }

                // Map Source Internal -> Label
                if (col.key === 'source' && value) {
                    const config = SOURCE_CONFIG[value];
                    if (config) value = config.label;
                }

                // Format Dates (created_at and next_followup_date)
                if ((col.key === 'created_at' || col.key === 'next_followup_date') && value) {
                    try {
                        const date = new Date(value);
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const year = date.getFullYear();
                        value = `${day}-${month}-${year}`;
                    } catch (e) { value = ''; }
                }

                // Ensure value is string and handle nulls
                value = (value === null || value === undefined) ? '' : String(value);

                // Escape quotes and wrap in quotes if contains comma, newline or quotes
                if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }

                return value;
            }).join(',');
        });

        const headers = CSV_COLUMNS.map(col => col.label).join(',');
        const csvContent = [headers, ...rows].join('\n');

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
