export const CSV_COLUMNS = [
    { key: 'name', label: 'Nombre Completo' },
    { key: 'company_name', label: 'Empresa' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'source', label: 'Fuente (redes_sociales, referidos, visita_campo, sitio_web, etc)' },
    { key: 'priority', label: 'Prioridad (very_high, high, medium, low)' },
    { key: 'status', label: 'Estado (Nuevo lead, En seguimiento, etc)' },
    { key: 'value', label: 'Valor Estimado' },
    { key: 'next_action_notes', label: 'Notas iniciales' }
];

export const csvHelper = {
    generateTemplate() {
        const headers = CSV_COLUMNS.map(col => col.label).join(',');
        const exampleRow = CSV_COLUMNS.map(col => {
            if (col.key === 'priority') return 'medium';
            if (col.key === 'status') return 'Nuevo lead';
            if (col.key === 'value') return '1000';
            if (col.key === 'source') return 'redes_sociales';
            if (col.key === 'name') return 'Juan Pérez';
            if (col.key === 'email') return 'juan@ejemplo.com';
            if (col.key === 'phone') return '123456789';
            if (col.key === 'company_name') return 'Empresa A.C.';
            return `Ejemplo ${col.label}`;
        }).join(',');

        const csvContent = `${headers}\n${exampleRow}`;
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

                                    if (col.key === 'value') {
                                        val = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
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
    }
};
