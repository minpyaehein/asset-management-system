BEGIN;

DO $$
DECLARE
  superadmin_user_id INTEGER;
  superadmin_role_id INTEGER;
BEGIN
  SELECT id, role_id
  INTO superadmin_user_id, superadmin_role_id
  FROM users
  WHERE id = 1
    AND LOWER(username) = 'superadmin'
  LIMIT 1;

  IF superadmin_user_id IS NULL THEN
    RAISE EXCEPTION
      'Reset cancelled: superadmin user ID 1 was not found.';
  END IF;

  IF superadmin_role_id <> 3 THEN
    RAISE EXCEPTION
      'Reset cancelled: expected Super Admin role ID 3, found %.',
      superadmin_role_id;
  END IF;
END
$$;

-- Remove all application data.
-- Add or remove table names here if your current schema differs.

TRUNCATE TABLE
  notifications,
  audit_logs,
  asset_allocations,
  service_desk_tickets,
  asset_transfers,
  acknowledgements,
  asset_disposals,
  maintenance_records,
  software_management_records
RESTART IDENTITY CASCADE;

TRUNCATE TABLE
  assets,
  employees
RESTART IDENTITY CASCADE;

-- Keep only the confirmed superadmin user.

DELETE FROM users
WHERE id <> 1;

-- Keep only permissions belonging to the Super Admin role.

DELETE FROM role_permissions
WHERE role_id <> 3;

-- Keep only the Super Admin role.

DELETE FROM roles
WHERE id <> 3;

-- Ensure the retained account and role remain active.

UPDATE users
SET
  status = 'Active',
  updated_at = NOW()
WHERE id = 1
  AND LOWER(username) = 'superadmin';

UPDATE roles
SET
  is_active = TRUE,
  updated_at = NOW()
WHERE id = 3;

-- Reset sequences to continue after retained IDs.

SELECT setval(
  pg_get_serial_sequence('users', 'id'),
  1,
  TRUE
);

SELECT setval(
  pg_get_serial_sequence('roles', 'id'),
  3,
  TRUE
);

SELECT setval(
  pg_get_serial_sequence('role_permissions', 'id'),
  GREATEST(
    COALESCE(
      (
        SELECT MAX(id)
        FROM role_permissions
      ),
      1
    ),
    1
  ),
  TRUE
);

COMMIT;
