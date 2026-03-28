-- Migración para añadir soporte de notificaciones de Telegram en el perfil de cada miembro del equipo
-- Ejecutado exitosamente en producción (Marzo 28, 2026)
ALTER TABLE profiles ADD COLUMN telegram_chat_id TEXT;
