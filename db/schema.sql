
-- Users & Roles
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Core
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT,
  closure_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS investors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS commitments (
  id TEXT PRIMARY KEY,
  investor_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  amount REAL NOT NULL,
  start_date TEXT,
  end_date TEXT,
  frequency TEXT,
  tier TEXT,
  roi_min_pct REAL,
  roi_max_pct REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT,
  direction TEXT,
  wallet TEXT,
  category TEXT,
  amount REAL,
  batch_id TEXT,
  cow_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS distributions (
  id TEXT PRIMARY KEY,
  batch_id TEXT,
  date TEXT,
  kind TEXT,
  investor_id TEXT,
  amount REAL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Wallets & Categories
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  opening_balance REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS wallets_name_unique ON wallets(name);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_kind_name_unique ON categories(kind, name);

-- Cows
CREATE TABLE IF NOT EXISTS cows (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  purchase_date TEXT,
  purchase_weight_kg REAL,
  purchase_height_cm REAL,
  purchase_price REAL,
  source TEXT,
  status TEXT DEFAULT 'in_farm',
  photo_url TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS cows_batch_tag_unique ON cows(batch_id, tag);

CREATE TABLE IF NOT EXISTS measurements (
  id TEXT PRIMARY KEY,
  cow_id TEXT NOT NULL,
  date TEXT NOT NULL,
  weight_kg REAL,
  height_cm REAL,
  health_score INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cow_events (
  id TEXT PRIMARY KEY,
  cow_id TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  details TEXT,
  amount REAL,
  receipt_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);


-- Optional receipts for transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Generic files (for R2 uploads)
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  kind TEXT,           -- 'tx_receipt' | 'cow_photo' | 'event_receipt' | 'other'
  ref_id TEXT,         -- linked record id
  key TEXT,            -- R2 object key
  url TEXT,            -- public URL
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
