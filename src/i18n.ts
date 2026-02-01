import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enJSON from './locales/en.json';
import esJSON from './locales/es.json';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: enJSON },
            es: { translation: esJSON },
        },
        lng: 'es', // Force Spanish to match Production
        fallbackLng: 'es',
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
