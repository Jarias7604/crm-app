import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';

export function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const isSpanish = i18n.language?.startsWith('es');

    const toggleLanguage = () => {
        const newLang = isSpanish ? 'en' : 'es';
        i18n.changeLanguage(newLang);
    };

    return (
        <Button variant="ghost" size="sm" onClick={toggleLanguage} className="font-semibold text-gray-500 hover:text-indigo-600">
            {isSpanish ? '🇺🇸 EN' : '🇪🇸 ES'}
        </Button>
    );
}

