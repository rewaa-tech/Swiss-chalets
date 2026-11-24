-- v3 §6: fine-grained permissions + optional custom permission set for branch managers.

ALTER TABLE app_users ADD COLUMN perms_custom boolean NOT NULL DEFAULT false;

-- Map the v2 permission names to the new ones (old rows are replaced).
CREATE TEMP TABLE perm_map (old text, new text) ON COMMIT DROP;
INSERT INTO perm_map VALUES
  ('units.manage','units.view'), ('units.manage','units.create'), ('units.manage','units.edit'), ('units.manage','units.media'), ('units.manage','units.toggle'),
  ('pricing.manage','seasons.manage'), ('pricing.manage','slots.view'), ('pricing.manage','slots.manage'),
  ('slots.manage','slots.view'), ('slots.manage','slots.manage'),
  ('calendar.manage','calendar.view'), ('calendar.manage','calendar.open_close'),
  ('bookings.view','bookings.view'), ('bookings.view','bookings.view_proof'),
  ('bookings.review','bookings.view_proof'), ('bookings.review','bookings.confirm'), ('bookings.review','bookings.reject'),
  ('bookings.review','bookings.void'), ('bookings.review','bookings.manual'),
  ('blocklist.manage','blocklist.view'), ('blocklist.manage','blocklist.manage'), ('blocklist.manage','bookings.block'),
  ('branch.settings','branch.settings'), ('branch.settings','branch.payment'),
  ('staff.manage','staff.view'), ('staff.manage','staff.create'), ('staff.manage','staff.edit_permissions'), ('staff.manage','staff.disable');

CREATE TEMP TABLE perm_new ON COMMIT DROP AS
  SELECT DISTINCT p.user_id, m.new AS permission FROM user_permissions p JOIN perm_map m ON m.old = p.permission;
-- bookings.block also needs bookings.reject: only keep it when the user can reject.
DELETE FROM perm_new n WHERE n.permission = 'bookings.block'
  AND NOT EXISTS (SELECT 1 FROM perm_new r WHERE r.user_id = n.user_id AND r.permission = 'bookings.reject');
DELETE FROM user_permissions;
INSERT INTO user_permissions (user_id, permission) SELECT user_id, permission FROM perm_new;
