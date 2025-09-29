-- ========================
-- SureGrow Database Schema
-- ========================

-- Wallets
CREATE TABLE IF NOT EXISTS wallets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    balance REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT 'member',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Batches (e.g., Eid 2026)
CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Investors
CREATE TABLE IF NOT EXISTS investors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Commitments (investor investments)
CREATE TABLE IF NOT EXISTS commitments (
    id TEXT PRIMARY KEY,
    investor_id TEXT NOT NULL,
    batch_id TEXT,
    amount REAL NOT NULL,
    start_date TEXT,
    end_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Cows
CREATE TABLE IF NOT EXISTS cows (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    tag TEXT,
    purchase_price REAL,
    purchase_date TEXT,
    height REAL,
    weight REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Cow Measurements
CREATE TABLE IF NOT EXISTS measurements (
    id TEXT PRIMARY KEY,
    cow_id TEXT NOT NULL,
    date TEXT NOT NULL,
    height REAL,
    weight REAL,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Cow Events (sickness, vaccine, etc.)
CREATE TABLE IF NOT EXISTS cow_events (
    id TEXT PRIMARY KEY,
    cow_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT,          -- e.g., sickness, vaccine, medicine
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Expense / Income Categories
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,   -- 'expense' or 'income'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    direction TEXT NOT NULL,  -- 'in' or 'out'
    wallet_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    batch_id TEXT,
    cow_id TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Distributions (profit payouts)
CREATE TABLE IF NOT EXISTS distributions (
    id TEXT PRIMARY KEY,
    investor_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Files (receipts, cow photos, etc.)
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    kind TEXT,           -- 'tx_receipt' | 'cow_photo' | 'event_receipt' | 'other'
    ref_id TEXT,         -- linked record id
    key TEXT,            -- R2 object key
    url TEXT,            -- Public URL
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ===============
-- Schema Upgrades
-- ===============
-- Add receipt_url column to transactions (only run once if not already present)
ALTER TABLE transactions ADD COLUMN receipt_url TEXT;
