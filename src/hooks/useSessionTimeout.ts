import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider';
import toast from 'react-hot-toast';

const TIMEOUT_MINUTES = 30;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;
const WARNING_MS = 1 * 60 * 1000; // 1 minute before timeout

export function useSessionTimeout() {
    const { session, signOut } = useAuth();
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleLogout = useCallback(async () => {
        if (!session) return;
        toast.error('Tu sesión ha expirado por inactividad.');
        await signOut();
    }, [session, signOut]);

    const resetTimeout = useCallback(() => {
        if (!session) return;

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningRef.current) clearTimeout(warningRef.current);

        // Set warning toast
        warningRef.current = setTimeout(() => {
            toast.error('Tu sesión expirará en 1 minuto por inactividad. Mueve el mouse para mantenerla activa.', {
                duration: 10000,
                icon: '⚠️',
            });
        }, TIMEOUT_MS - WARNING_MS);

        // Set actual logout
        timeoutRef.current = setTimeout(handleLogout, TIMEOUT_MS);
    }, [session, handleLogout]);

    useEffect(() => {
        if (!session) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (warningRef.current) clearTimeout(warningRef.current);
            return;
        }

        resetTimeout();

        const events = [
            'mousedown',
            'mousemove',
            'keydown',
            'scroll',
            'touchstart'
        ];

        // Usamos throttle para no llamar resetTimeout miles de veces por segundo
        let throttleTimer: ReturnType<typeof setTimeout> | null = null;
        const handleActivity = () => {
            if (throttleTimer) return;
            throttleTimer = setTimeout(() => {
                resetTimeout();
                throttleTimer = null;
            }, 1000); // 1 second throttle
        };

        events.forEach(event => {
            document.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, handleActivity);
            });
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (warningRef.current) clearTimeout(warningRef.current);
            if (throttleTimer) clearTimeout(throttleTimer);
        };
    }, [session, resetTimeout]);
}
