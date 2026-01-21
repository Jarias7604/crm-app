// CSV Template v3.0 - Updated 2026-01-21 - All roles use same headers
export const CSV_COLUMNS = [
    { key: 'name', label: 'Nombre completo' },
    { key: 'company_name', label: 'Empresa (opcional)' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'source', label: 'Fuente' },
    { key: 'priority', label: 'Prioridad' },
    { key: 'status', label: 'Estado' },
    { key: 'value', label: 'Valor' },
    { key: 'next_action_notes', label: 'Notas Iniciales' },
    { key: 'created_at', label: 'Fecha de Creación' }
];

export const csvHelper = {
    generateTemplate() {
        const headers = CSV_COLUMNS.map(col => col.label).join(',');

        // Add instruction row with examples
        const instructionRow = [
            'Juan Pérez',  // name (REQUERIDO)
            'Empresa A.C.',  // company_name (opcional)
            'juan@ejemplo.com',  // email
            '123456789',  // phone
            'Redes Sociales',  // source
            'Media',  // priority
            'Nuevo lead',  // status
            '1000',  // value
            'Contacto inicial por Facebook',  // notes
            '15-01-2026'  // created_at (formato DD-MM-YYYY)
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

    parse(file: File): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result as string;
                    if (!text) {
                        resolve([]);
                        return;
                    }

                    // Handle different line endings
                    const lines = text.split(/\r?\n/);
                    if (lines.length < 2) {
                        resolve([]);
                        return;
                    }

                    const headers = lines[0].split(',').map(h => h.trim().replace(/^[\uFEFF]/, ''));

                    const data = lines.slice(1)
                        .filter(row => row.trim().length > 0)
                        .map(row => {
                            // Basic CSV parsing (not handling complex quotes, but better than before)
                            const values = row.split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
                            const lead: any = {};

                            CSV_COLUMNS.forEach((col) => {
                                const headerIndex = headers.indexOf(col.label);
                                if (headerIndex !== -1 && headerIndex < values.length) {
                                    let val: any = values[headerIndex];

                                    // Clean instruction text from fields (text in parentheses)
                                    if (['priority', 'status', 'source'].includes(col.key) && val) {
                                        // Remove any instruction text in parentheses
                                        val = val.split('(')[0].trim();
                                    }

                                    // Map Spanish priority names to database codes
                                    if (col.key === 'priority' && val) {
                                        const priorityMap: Record<string, string> = {
                                            'muy alta': 'very_high',
                                            'muy_alta': 'very_high',
                                            'altísima': 'very_high',
                                            'alta': 'high',
                                            'media': 'medium',
                                            'baja': 'low',
                                            // English fallbacks
                                            'very_high': 'very_high',
                                            'high': 'high',
                                            'medium': 'medium',
                                            'low': 'low'
                                        };
                                        val = priorityMap[val.toLowerCase()] || val;
                                    }

                                    // Map Spanish source names to database codes
                                    if (col.key === 'source' && val) {
                                        const sourceMap: Record<string, string> = {
                                            'redes sociales': 'redes_sociales',
                                            'redes_sociales': 'redes_sociales',
                                            'referidos': 'referidos',
                                            'visita campo': 'visita_campo',
                                            'visita de campo': 'visita_campo',
                                            'visita_campo': 'visita_campo',
                                            'sitio web': 'sitio_web',
                                            'sitio_web': 'sitio_web',
                                            'llamada fría': 'llamada_fria',
                                            'llamada fria': 'llamada_fria',
                                            'llamada_fria': 'llamada_fria',
                                            'otro': 'otro',
                                            'otros': 'otro'
                                        };
                                        val = sourceMap[val.toLowerCase()] || val;
                                    }

                                    // Parse value as number
                                    if (col.key === 'value') {
                                        val = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
                                    }

                                    // Parse created_at date (DD-MM-YYYY format)
                                    if (col.key === 'created_at' && val) {
                                        // Remove any instruction text in parentheses
                                        val = val.split('(')[0].trim();

                                        // Validate date format DD-MM-YYYY
                                        const dateRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
                                        const match = val.match(dateRegex);

                                        if (match) {
                                            const day = match[1].padStart(2, '0');
                                            const month = match[2].padStart(2, '0');
                                            const year = match[3];

                                            // Convert DD-MM-YYYY to ISO format YYYY-MM-DD
                                            const isoDate = `${year}-${month}-${day}`;

                                            // Validate the date is valid
                                            const dateObj = new Date(isoDate + 'T12:00:00Z');
                                            if (!isNaN(dateObj.getTime())) {
                                                val = dateObj.toISOString();
                                            } else {
                                                // Invalid date, skip it
                                                val = undefined;
                                            }
                                        } else {
                                            // Invalid format, skip it
                                            val = undefined;
                                        }
                                    }

                                    if (val !== undefined && val !== '') {
                                        lead[col.key] = val;
                                    }
                                }
                            });
                            return lead;
                        });

                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsText(file);
        });
    },

    exportLeads(leads: any[], filename = 'leads_export.csv') {
        // Generate headers in the same order as template
        const headers = CSV_COLUMNS.map(col => col.label).join(',');

        // Map leads to CSV rows
        const rows = leads.map(lead => {
            return CSV_COLUMNS.map(col => {
                let value = lead[col.key] || '';

                // Format created_at date to DD-MM-YYYY
                if (col.key === 'created_at' && value) {
                    const date = new Date(value);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    value = `${day}-${month}-${year}`;
                }

                // Wrap in quotes if contains comma
                if (typeof value === 'string' && value.includes(',')) {
                    value = `"${value}"`;
                }

                return value;
            }).join(',');
        });

        const csvContent = [headers, ...rows].join('\n');

        // Use BOM for Excel encoding compatibility
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
