import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';

export default function Home() {
    const navigate = useNavigate();
    const isMobile = window.innerWidth < 1024;

    // Si es móvil, redirigir al menú de accesos rápidos (que ya existe en Leads)
    useEffect(() => {
        if (isMobile) {
            // El botón flotante de MobileQuickActions ya existe en todas las páginas móviles
            // Solo mostramos el dashboard normal
        }
    }, [isMobile, navigate]);

    return <Dashboard />;
}
