-- FIX: Missing admin_delete_user function
-- This function allows admins to delete users from the system
-- Includes proper security checks and cascading deletes

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_company_id uuid;
    v_my_company_id uuid;
    v_my_role text;
BEGIN
    -- Get my role and company
    v_my_role := public.get_auth_role();
    v_my_company_id := public.get_auth_company_id();
    
    -- Only super_admin or company_admin can delete
    IF v_my_role NOT IN ('super_admin', 'company_admin') THEN
        RAISE EXCEPTION 'No autorizado: Solo administradores pueden eliminar usuarios';
    END IF;
    
    -- Get target user's company
    SELECT company_id INTO v_target_company_id 
    FROM public.profiles 
    WHERE id = target_user_id;
    
    -- Company admins can only delete users from their own company
    IF v_my_role = 'company_admin' AND v_target_company_id != v_my_company_id THEN
        RAISE EXCEPTION 'No autorizado: Solo puedes eliminar usuarios de tu empresa';
    END IF;
    
    -- Prevent deleting yourself
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'No puedes eliminarte a ti mismo';
    END IF;
    
    -- Delete from public.profiles first (foreign key)
    DELETE FROM public.profiles WHERE id = target_user_id;
    
    -- Delete from auth.identities
    DELETE FROM auth.identities WHERE user_id = target_user_id;
    
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = target_user_id;
    
END;
$$;
