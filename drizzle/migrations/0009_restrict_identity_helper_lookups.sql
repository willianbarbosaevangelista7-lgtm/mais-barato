-- Prevent authenticated users from probing another user's roles or market memberships.
-- Self-lookups are allowed; only an authenticated administrator may inspect others.
-- The wrappers remain executable by anon because catalog RLS policies call them;
-- unauthenticated calls always return false.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF _user_id <> auth.uid()
     AND NOT EXISTS (
       SELECT 1
       FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role = 'admin'::public.app_role
     ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_market_member(_user_id uuid, _market_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR _user_id IS NULL OR _market_id IS NULL THEN
    RETURN false;
  END IF;

  IF _user_id <> auth.uid()
     AND NOT EXISTS (
       SELECT 1
       FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role = 'admin'::public.app_role
     ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.market_members mm
    WHERE mm.user_id = _user_id
      AND mm.market_id = _market_id
  );
END;
$$;

-- Explicit grants: anon needs the guarded wrappers for public catalog RLS;
-- authenticated users need them for their own policies; service_role retains access.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_market_member(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_market_member(uuid, text) TO anon, authenticated, service_role;
