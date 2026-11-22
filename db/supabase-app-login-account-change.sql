CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  old_email constant text := 'longdra.llc@gmail.com';
  new_email constant text := 'office@out-of-office.design';
  new_password constant text := 'ooooooooo';
  old_user_id uuid;
  new_user_id uuid;
  create_user_id uuid := gen_random_uuid();
BEGIN
  UPDATE public.app_users
  SET email = new_email
  WHERE email ILIKE old_email;

  IF NOT FOUND THEN
    INSERT INTO public.app_users (email, stopped)
    VALUES (new_email, false)
    ON CONFLICT (email) DO UPDATE
      SET stopped = false;
  END IF;

  SELECT id INTO old_user_id
  FROM auth.users
  WHERE email ILIKE old_email
  LIMIT 1;

  SELECT id INTO new_user_id
  FROM auth.users
  WHERE email ILIKE new_email
  LIMIT 1;

  IF new_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      encrypted_password = crypt(new_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE id = new_user_id;

    IF old_user_id IS NOT NULL AND old_user_id <> new_user_id THEN
      DELETE FROM auth.users WHERE id = old_user_id;
    END IF;

    RETURN;
  END IF;

  IF old_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      email = new_email,
      encrypted_password = crypt(new_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE id = old_user_id;

    UPDATE auth.identities
    SET
      provider_id = new_email,
      email = new_email,
      identity_data = jsonb_set(
        jsonb_set(identity_data, '{email}', to_jsonb(new_email)),
        '{email_verified}', 'true'::jsonb
      ),
      updated_at = NOW()
    WHERE user_id = old_user_id
      AND provider = 'email';

    RETURN;
  END IF;

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    create_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    new_email,
    crypt(new_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at,
    email
  ) VALUES (
    gen_random_uuid(),
    create_user_id,
    jsonb_build_object(
      'sub', create_user_id::text,
      'email', new_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    new_email,
    NOW(),
    NOW(),
    NOW(),
    new_email
  );
END $$;

SELECT 'app_users' AS source, email, stopped
FROM public.app_users
WHERE email ILIKE 'office@out-of-office.design';

SELECT 'auth.users' AS source, id, email, email_confirmed_at
FROM auth.users
WHERE email ILIKE 'office@out-of-office.design';

SELECT 'auth.users_old' AS source, id, email
FROM auth.users
WHERE email ILIKE 'longdra.llc@gmail.com';
