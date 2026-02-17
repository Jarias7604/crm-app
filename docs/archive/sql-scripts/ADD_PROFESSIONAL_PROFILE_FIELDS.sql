-- Añadir campos profesionales a los perfiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;

-- Comentarios explicativos
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL de la foto de perfil del usuario';
COMMENT ON COLUMN public.profiles.website IS 'Sitio web profesional o de la empresa del usuario';
