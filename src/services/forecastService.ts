import { supabase } from './supabase';

export interface ForecastEntry {
    id?: string;
    company_id: string;
    year: number;
    month: number;
    goal_leads: number;
    goal_value: number;
}

export interface ForecastWithActual extends ForecastEntry {
    actual_leads: number;
    actual_value: number;
}

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_NAMES_SHORT = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export const forecastService = {
    MONTH_NAMES,
    MONTH_NAMES_SHORT,

    /**
     * Get forecast for a specific year
     */
    async getForecast(companyId: string, year: number): Promise<ForecastEntry[]> {
        const { data, error } = await supabase
            .from('sales_forecast')
            .select('*')
            .eq('company_id', companyId)
            .eq('year', year)
            .order('month');

        if (error) {
            console.error('Error fetching forecast:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Save forecast for the entire year (upsert all 12 months)
     */
    async saveForecast(
        companyId: string,
        year: number,
        months: { month: number; goal_leads: number; goal_value: number }[]
    ): Promise<void> {
        const records = months.map(m => ({
            company_id: companyId,
            year,
            month: m.month,
            goal_leads: m.goal_leads,
            goal_value: m.goal_value,
            updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('sales_forecast')
            .upsert(records, { onConflict: 'company_id,year,month' });

        if (error) {
            console.error('Error saving forecast:', error);
            throw error;
        }
    },

    /**
     * Get actual sales data broken down by month for a year
     */
    async getActualsByMonth(companyId: string, year: number): Promise<Record<number, { leads: number; value: number }>> {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31T23:59:59`;

        const { data: wonLeads, error } = await supabase
            .from('leads')
            .select('id, closing_amount, internal_won_date')
            .eq('company_id', companyId)
            .in('status', ['Cerrado', 'Cliente'])
            .not('internal_won_date', 'is', null)
            .gte('internal_won_date', startDate)
            .lte('internal_won_date', endDate);

        if (error) {
            console.error('Error fetching actuals:', error);
            return {};
        }

        const result: Record<number, { leads: number; value: number }> = {};
        for (let m = 1; m <= 12; m++) {
            result[m] = { leads: 0, value: 0 };
        }

        (wonLeads || []).forEach(lead => {
            const d = new Date(lead.internal_won_date);
            const m = d.getMonth() + 1;
            if (result[m]) {
                result[m].leads++;
                result[m].value += Number(lead.closing_amount || 0);
            }
        });

        return result;
    },

    /**
     * Get combined forecast + actuals for chart rendering
     */
    async getForecastWithActuals(companyId: string, year: number): Promise<ForecastWithActual[]> {
        const [forecast, actuals] = await Promise.all([
            this.getForecast(companyId, year),
            this.getActualsByMonth(companyId, year),
        ]);

        const forecastMap: Record<number, ForecastEntry> = {};
        forecast.forEach(f => { forecastMap[f.month] = f; });

        const result: ForecastWithActual[] = [];
        for (let m = 1; m <= 12; m++) {
            const fc = forecastMap[m];
            const act = actuals[m] || { leads: 0, value: 0 };
            result.push({
                company_id: companyId,
                year,
                month: m,
                goal_leads: fc?.goal_leads || 0,
                goal_value: fc?.goal_value || 0,
                actual_leads: act.leads,
                actual_value: act.value,
            });
        }

        return result;
    },
};
