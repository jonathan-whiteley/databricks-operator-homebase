-- src/lakehouse_market/lakebase_schema.sql
CREATE TABLE IF NOT EXISTS app_labor_overrides (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL,
  date DATE NOT NULL,
  daypart TEXT NOT NULL,
  headcount INT NOT NULL,
  note TEXT,
  manager_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_offer_pushes (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL,
  member_id BIGINT,
  offer_id INT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('member', 'counter_prompt')),
  daypart TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL,
  sku_id INT NOT NULL,
  supplier_id INT NOT NULL,
  quantity INT NOT NULL,
  target_date DATE NOT NULL,
  manager_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_review_responses (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL,
  review_id BIGINT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('respond', 'flag', 'resolve')),
  response_text TEXT,
  manager_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_work_orders (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL,
  equipment_id BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'done')) DEFAULT 'open',
  target_date DATE,
  notes TEXT,
  manager_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
