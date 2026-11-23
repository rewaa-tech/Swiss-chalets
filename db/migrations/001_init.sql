-- Swiss Chalets — initial schema
-- All timestamps are stored in UTC (timestamptz). Business logic runs in Asia/Damascus.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ───────────────────────── Branches & units ─────────────────────────
CREATE TABLE branches (
  id                      serial PRIMARY KEY,
  name                    text NOT NULL,
  slug                    text NOT NULL UNIQUE,
  city                    text NOT NULL DEFAULT '',
  description             text NOT NULL DEFAULT '',
  map_url                 text,
  status                  text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','ComingSoon','Hidden')),
  shamcash_account_name   text,
  shamcash_account_number text,
  shamcash_qr_path        text,
  review_start            time NOT NULL DEFAULT '09:00',
  review_end              time NOT NULL DEFAULT '23:00',
  cover_media_path        text,
  sort_order              int  NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE units (
  id               serial PRIMARY KEY,
  branch_id        int  NOT NULL REFERENCES branches(id),
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  type             text NOT NULL DEFAULT 'Chalet' CHECK (type IN ('Chalet','Farm')),
  description      text NOT NULL DEFAULT '',
  capacity         int  NOT NULL CHECK (capacity > 0),
  bedrooms         int  NOT NULL DEFAULT 0 CHECK (bedrooms >= 0),
  bathrooms        int  NOT NULL DEFAULT 0 CHECK (bathrooms >= 0),
  has_heated_pool  boolean NOT NULL DEFAULT false,
  allowed_category text NOT NULL DEFAULT 'FamilyAndYouth' CHECK (allowed_category IN ('FamilyOnly','FamilyAndYouth')),
  rules            text NOT NULL DEFAULT '',
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       int  NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_units_branch ON units (branch_id, is_active, sort_order);

CREATE TABLE unit_media (
  id          serial PRIMARY KEY,
  unit_id     int  NOT NULL REFERENCES units(id),
  path_base   text NOT NULL,           -- e.g. units/12/ab12cd → files {path_base}-480.webp, -960, -1600
  width       int  NOT NULL,
  height      int  NOT NULL,
  is_cover    boolean NOT NULL DEFAULT false,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_unit_media_unit ON unit_media (unit_id, sort_order);

CREATE TABLE amenities (
  id    serial PRIMARY KEY,
  name  text NOT NULL UNIQUE,
  icon  text NOT NULL DEFAULT 'check'
);

CREATE TABLE unit_amenities (
  unit_id    int NOT NULL REFERENCES units(id),
  amenity_id int NOT NULL REFERENCES amenities(id),
  PRIMARY KEY (unit_id, amenity_id)
);

-- ───────────────────────── Seasons, modes, slots ─────────────────────────
CREATE TABLE seasons (
  id         serial PRIMARY KEY,
  branch_id  int  NOT NULL REFERENCES branches(id),
  kind       text NOT NULL CHECK (kind IN ('Summer','Winter','Spring','Autumn')),
  start_date date NOT NULL,
  end_date   date NOT NULL,
  CHECK (end_date >= start_date),
  UNIQUE (branch_id, kind)
);
ALTER TABLE seasons ADD CONSTRAINT no_season_overlap
  EXCLUDE USING gist (branch_id WITH =, daterange(start_date, end_date, '[]') WITH &&);

CREATE TABLE unit_season_modes (
  unit_id   int  NOT NULL REFERENCES units(id),
  season_id int  NOT NULL REFERENCES seasons(id),
  mode      text NOT NULL CHECK (mode IN ('Pool','Hotel')),
  PRIMARY KEY (unit_id, season_id)
);

CREATE TABLE time_slots (
  id               serial PRIMARY KEY,
  unit_id          int  NOT NULL REFERENCES units(id),
  season_id        int  NOT NULL REFERENCES seasons(id),
  kind             text NOT NULL CHECK (kind IN ('Hours6','Hours10','FullDay','HotelNight')),
  name             text NOT NULL,
  start_time       time NOT NULL,
  duration_minutes int  NOT NULL CHECK (duration_minutes BETWEEN 60 AND 2880),
  price            numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'HotelNight' OR duration_minutes <= 1440)
);
CREATE INDEX ix_slots_unit_season ON time_slots (unit_id, season_id, is_active);

CREATE TABLE open_days (
  unit_id int  NOT NULL REFERENCES units(id),
  day     date NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  PRIMARY KEY (unit_id, day)
);

-- ───────────────────────── Bookings ─────────────────────────
CREATE TABLE bookings (
  id               bigserial PRIMARY KEY,
  status_token     char(32) NOT NULL UNIQUE,
  unit_id          int  NOT NULL REFERENCES units(id),
  branch_id        int  NOT NULL REFERENCES branches(id),
  source           text NOT NULL DEFAULT 'Online' CHECK (source IN ('Online','Manual')),
  customer_name    text NOT NULL,
  phone_e164       text NOT NULL,
  category         text NOT NULL CHECK (category IN ('Family','Youth')),
  persons          int  NOT NULL CHECK (persons > 0),
  notes            text,
  status           text NOT NULL CHECK (status IN ('Held','PendingReview','Confirmed','Completed','Expired','Rejected','VoidNoDocuments')),
  total            numeric(12,2) NOT NULL,
  currency         text NOT NULL DEFAULT 'USD',
  exchange_rate    numeric(14,4) NOT NULL DEFAULT 0,
  hold_expires_at  timestamptz,
  proof_at         timestamptz,
  review_due_at    timestamptz,
  first_alert_at   timestamptz,
  alert_due_at     timestamptz,
  last_reminder_at timestamptz,
  escalated_at     timestamptz,
  reviewed_by      int,
  reviewed_at      timestamptz,
  reject_reason    text,
  ip_hash          text,
  device_hash      text,
  created_by       int,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_bookings_hold   ON bookings (status, hold_expires_at);
CREATE INDEX ix_bookings_phone  ON bookings (phone_e164, status);
CREATE INDEX ix_bookings_ip     ON bookings (ip_hash, created_at);
CREATE INDEX ix_bookings_device ON bookings (device_hash, created_at);
CREATE INDEX ix_bookings_review ON bookings (branch_id, status, review_due_at);

CREATE TABLE booking_items (
  id           bigserial PRIMARY KEY,
  booking_id   bigint NOT NULL REFERENCES bookings(id),
  unit_id      int    NOT NULL REFERENCES units(id),
  time_slot_id int    NOT NULL REFERENCES time_slots(id),
  day          date   NOT NULL,
  period       tstzrange NOT NULL,
  price        numeric(12,2) NOT NULL,
  is_active    boolean NOT NULL DEFAULT true
);
-- The hard guarantee against double booking (BR-06).
ALTER TABLE booking_items ADD CONSTRAINT no_overlap_per_unit
  EXCLUDE USING gist (unit_id WITH =, period WITH &&) WHERE (is_active);
CREATE INDEX ix_items_unit_period ON booking_items USING gist (unit_id, period);
CREATE INDEX ix_items_booking ON booking_items (booking_id);

CREATE TABLE payment_proofs (
  booking_id         bigint PRIMARY KEY REFERENCES bookings(id),
  transaction_number text,
  proof_kind         text CHECK (proof_kind IN ('Image','Pdf')),
  file_path          text,
  original_name      text,
  size_bytes         int,
  page_count         int,
  uploaded_at        timestamptz NOT NULL DEFAULT now(),
  delete_after       timestamptz,
  file_deleted_at    timestamptz
);
CREATE UNIQUE INDEX ux_proofs_txn ON payment_proofs (transaction_number) WHERE transaction_number IS NOT NULL;

-- ───────────────────────── Users & permissions ─────────────────────────
CREATE TABLE app_users (
  id                   serial PRIMARY KEY,
  username             text NOT NULL,
  display_name         text NOT NULL,
  password_hash        text NOT NULL,
  role                 text NOT NULL CHECK (role IN ('SuperAdmin','BranchManager','Staff')),
  branch_id            int REFERENCES branches(id),
  is_active            boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  security_stamp       text NOT NULL,
  telegram_chat_id     bigint,
  telegram_link_code   text,
  created_by           int,
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_login_at        timestamptz,
  CHECK ((role = 'SuperAdmin') = (branch_id IS NULL))
);
CREATE UNIQUE INDEX ux_users_username ON app_users (lower(username));

CREATE TABLE user_sessions (
  id             text PRIMARY KEY,          -- sha256(token)
  user_id        int  NOT NULL REFERENCES app_users(id),
  security_stamp text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL
);
CREATE INDEX ix_sessions_user ON user_sessions (user_id);

CREATE TABLE user_permissions (
  user_id    int  NOT NULL REFERENCES app_users(id),
  permission text NOT NULL,
  PRIMARY KEY (user_id, permission)
);

-- ───────────────────────── Protection ─────────────────────────
CREATE TABLE blocked_identities (
  id          serial PRIMARY KEY,
  branch_id   int REFERENCES branches(id),
  kind        text NOT NULL CHECK (kind IN ('Phone','Ip','Device')),
  value       text NOT NULL,
  label       text,
  reason      text NOT NULL,
  booking_id  bigint REFERENCES bookings(id),
  blocked_by  int REFERENCES app_users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  is_active   boolean NOT NULL DEFAULT true,
  lifted_by   int REFERENCES app_users(id),
  lifted_at   timestamptz
);
CREATE UNIQUE INDEX ux_blocked_active ON blocked_identities (kind, value) WHERE is_active;

-- ───────────────────────── Contacts ─────────────────────────
CREATE TABLE contact_numbers (
  id          serial PRIMARY KEY,
  label       text NOT NULL,
  phone_e164  text NOT NULL,
  branch_id   int REFERENCES branches(id),
  is_default  boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_contact_default ON contact_numbers (is_default) WHERE is_default;

CREATE TABLE page_contacts (
  id          serial PRIMARY KEY,
  page_type   text NOT NULL CHECK (page_type IN ('Home','Branch','Unit','Booking','Terms','My')),
  entity_id   int,
  contact_id  int NOT NULL REFERENCES contact_numbers(id)
);
CREATE UNIQUE INDEX ux_page_contacts ON page_contacts (page_type, COALESCE(entity_id, 0));

-- ───────────────────────── Settings, templates, logs ─────────────────────────
CREATE TABLE settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE message_templates (
  key   text PRIMARY KEY,
  body  text NOT NULL
);

CREATE TABLE audit_logs (
  id         bigserial PRIMARY KEY,
  user_id    int REFERENCES app_users(id),
  branch_id  int REFERENCES branches(id),
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  text,
  details    jsonb,
  is_manual  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_created ON audit_logs (created_at DESC);
CREATE INDEX ix_audit_user ON audit_logs (user_id, created_at DESC);

CREATE TABLE notifications_log (
  id          bigserial PRIMARY KEY,
  booking_id  bigint REFERENCES bookings(id),
  user_id     int REFERENCES app_users(id),
  kind        text NOT NULL,
  channel     text NOT NULL DEFAULT 'Telegram',
  status      text NOT NULL,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────── Defaults ─────────────────────────
INSERT INTO settings (key, value) VALUES
  ('currency', 'USD'),
  ('show_syp', 'false'),
  ('exchange_rate', '0'),
  ('hold_minutes', '30'),
  ('max_active_per_phone', '2'),
  ('max_daily_per_ip', '2'),
  ('max_daily_per_device', '2'),
  ('min_fill_seconds', '5'),
  ('theme_mode', 'Auto'),
  ('theme_winter_months', '12,1,2'),
  ('theme_summer_months', '6,7,8'),
  ('booking_mechanism_text', 'نحجز لك الوقت 30 دقيقة بعد إدخال بياناتك. ادفع المبلغ كاملًا عبر شام كاش إلى حساب فرع {الفرع}، ثم ارفع الإشعار مع رقم العملية. يراجع الفرع الدفعات من {البداية} حتى {النهاية}، ونؤكد لك عبر واتساب.'),
  ('documents_text', 'العائلي: الهوية ودفتر العائلة. الشبابي: هوية واحدة. يُلغى الحجز إذا لم تُحضر الثبوتيات عند الوصول.'),
  ('terms_text', 'الحجز من الموقع حصرًا، ويُدفع المبلغ كاملًا عبر شام كاش.
لا يمكن إلغاء الحجز أو استرداد المبلغ بعد التثبيت.
يجب إحضار الثبوتيات عند الوصول، وإلا يُلغى الحجز.
يُلتزم بعدد الأشخاص المسجل في الحجز.'),
  ('hash_salt', md5(random()::text || clock_timestamp()::text)),
  ('hero_image', '/img/hero/chalet-pool-dusk');

INSERT INTO message_templates (key, body) VALUES
  ('confirm', 'مرحبًا {الاسم} 🌲
تم تثبيت حجزك في {الوحدة} - فرع {الفرع}.
الموعد: {التاريخ} من {البداية} إلى {النهاية}
الموقع: {رابط الخريطة}
يرجى إحضار: {الثبوتيات}
ننتظركم - الأكواخ السويسرية'),
  ('reject', 'مرحبًا {الاسم}،
نعتذر، لم نتمكن من تثبيت طلبك في {الوحدة} بتاريخ {التاريخ}.
السبب: {السبب}
للاستفسار يسعدنا تواصلك على هذا الرقم.');

INSERT INTO amenities (name, icon) VALUES
  ('مسبح خاص', 'pool'), ('مسبح مدفأ', 'heat'), ('واي فاي', 'wifi'), ('مطبخ مجهز', 'kitchen'),
  ('شواء', 'grill'), ('موقف سيارات', 'parking'), ('تكييف', 'ac'), ('تدفئة', 'heater'), ('حديقة', 'garden');

INSERT INTO branches (name, slug, city, status, sort_order) VALUES
  ('إدلب', 'idlib', 'إدلب', 'Active', 1),
  ('حمص', 'homs', 'حمص', 'Active', 2),
  ('دمشق', 'damascus', 'دمشق', 'ComingSoon', 3);
