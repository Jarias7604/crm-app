import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';

export function LanguageSwitcher() {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'es' ? 'en' : 'es';
        i18n.changeLanguage(newLang);
    };

    return (
        <Button variant="ghost" size="sm" onClick={toggleLanguage} className="font-semibold text-gray-500 hover:text-indigo-600">
            {i18n.language === 'es' ? '🇺🇸 EN' : '🇪🇸 ES'}
        </Button>
    );
}
