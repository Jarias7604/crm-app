import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface LossStatistic {
    reason_id: string;
    reason_name: string;
    loss_count: number;
    percentage: number;
    cumulative_percentage: number;
}

export const lossStatisticsService = {
    /**
     * Get loss statistics with Pareto analysis
     * @param startDate Optional start date for filtering
     * @param endDate Optional end date for filtering
     * @returns Array of loss statistics sorted by count (descending)
     */
    async getLossStatistics(
        startDate?: Date,
        endDate?: Date
    ): Promise<LossStatistic[]> {
        try {
            const { data, error } = await supabase.rpc('get_loss_statistics', {
                p_company_id: null,
                p_start_date: startDate?.toISOString() || null,
                p_end_date: endDate?.toISOString() || null
            });

            if (error) throw error;

            return (data || []).map((item: any) => ({
                reason_id: item.reason_id,
                reason_name: item.reason_name,
                loss_count: Number(item.loss_count),
                percentage: Number(item.percentage),
                cumulative_percentage: Number(item.cumulative_percentage)
            }));
        } catch (error: any) {
            logger.error('Failed to get loss statistics', error, {
                action: 'getLossStatistics',
                startDate,
                endDate
            });
            throw error;
        }
    },

    /**
     * Get loss stage statistics
     */
    async getLossStageStatistics(
        startDate?: Date,
        endDate?: Date
    ): Promise<{ stage_name: string; loss_count: number; percentage: number }[]> {
        try {
            const { data, error } = await supabase.rpc('get_loss_stage_statistics', {
                p_company_id: null,
                p_start_date: startDate?.toISOString() || null,
                p_end_date: endDate?.toISOString() || null
            });

            if (error) throw error;

            return (data || []).map((item: any) => ({
                stage_name: item.stage_name,
                loss_count: Number(item.loss_count),
                percentage: Number(item.percentage)
            }));
        } catch (error: any) {
            logger.error('Failed to get loss stage statistics', error, {
                action: 'getLossStageStatistics',
                startDate,
                endDate
            });
            throw error;
        }
    },

    /**
     * Export loss statistics to CSV
     * @param stats Loss statistics data
     * @returns CSV string
     */
    exportToCSV(stats: LossStatistic[]): string {
        const headers = [
            'Motivo',
            'Cantidad de Leads Perdidos',
            'Porcentaje (%)',
            'Porcentaje Acumulado (%)',
            'Fecha de Exportación'
        ];

        const exportDate = new Date().toLocaleString('es-ES');

        const rows = stats.map(stat => [
            stat.reason_name,
            stat.loss_count.toString(),
            stat.percentage.toFixed(2),
            stat.cumulative_percentage.toFixed(2),
            exportDate
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return csvContent;
    },

    /**
     * Download CSV file
     * @param stats Loss statistics data
     */
    downloadCSV(stats: LossStatistic[]): void {
        const csv = this.exportToCSV(stats);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `motivos_perdida_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
