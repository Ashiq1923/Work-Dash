-- ============================================
-- WorkDash Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- 1. Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'user' CHECK (type IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
  OR NOT EXISTS (SELECT 1 FROM profiles)
);
CREATE POLICY "Admins can delete profiles" ON profiles FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'type', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Helpers
CREATE TABLE helpers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE helpers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "helpers_policy" ON helpers FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 3. Operators
CREATE TABLE operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  machine TEXT DEFAULT 'M1',
  head INTEGER NOT NULL,
  default_helper_id UUID REFERENCES helpers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operators_policy" ON operators FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 4. Production Sheets
CREATE TABLE production_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  machine TEXT DEFAULT 'M1',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, operator_id, month)
);
ALTER TABLE production_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sheets_policy" ON production_sheets FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 5. Production Day Entries
CREATE TABLE production_day_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES production_sheets(id) ON DELETE CASCADE,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  production NUMERIC DEFAULT 0,
  use_default_helper BOOLEAN DEFAULT true,
  extra_helper_id UUID REFERENCES helpers(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'alternet',
  rate NUMERIC DEFAULT 0,
  substitute_operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  UNIQUE(sheet_id, day)
);
ALTER TABLE production_day_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "day_entries_policy" ON production_day_entries FOR ALL USING (
  EXISTS (
    SELECT 1 FROM production_sheets ps
    WHERE ps.id = production_day_entries.sheet_id
    AND (ps.user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin'))
  )
);

-- 6. Parties (global)
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties_read" ON parties FOR SELECT USING (true);
CREATE POLICY "parties_write" ON parties FOR INSERT WITH CHECK (true);
CREATE POLICY "parties_delete" ON parties FOR DELETE USING (true);

-- 7. Articles
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  article_name TEXT,
  machine_head INTEGER,
  avg_production NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "articles_policy" ON articles FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 8. Article Components
CREATE TABLE article_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  name TEXT,
  stitch NUMERIC DEFAULT 0,
  qty_or_meter TEXT DEFAULT 'qty',
  value NUMERIC DEFAULT 0,
  type TEXT DEFAULT 'alternet',
  sort_order INTEGER DEFAULT 0
);
ALTER TABLE article_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "components_policy" ON article_components FOR ALL USING (
  EXISTS (
    SELECT 1 FROM articles a
    WHERE a.id = article_components.article_id
    AND (a.user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin'))
  )
);

-- 9. Salary Overrides
CREATE TABLE salary_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL,
  month TEXT NOT NULL,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  production NUMERIC DEFAULT 0,
  description TEXT,
  UNIQUE(user_id, operator_id, month, day)
);
ALTER TABLE salary_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salary_overrides_policy" ON salary_overrides FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 10. G-Exp Entries
CREATE TABLE gexp_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  component TEXT NOT NULL,
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE gexp_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gexp_policy" ON gexp_entries FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 11. Thread Accounts
CREATE TABLE thread_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE thread_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thread_accounts_policy" ON thread_accounts FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 12. Thread Entries
CREATE TABLE thread_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES thread_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT,
  amount NUMERIC DEFAULT 0,
  pay NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE thread_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thread_entries_policy" ON thread_entries FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 13. Ledger Accounts
CREATE TABLE ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ledger_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_accounts_policy" ON ledger_accounts FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 14. Ledger Entries
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT,
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_entries_policy" ON ledger_entries FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 15. Workers
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workers_policy" ON workers FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 16. Worker Salary Entries
CREATE TABLE worker_salary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE worker_salary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "worker_salary_policy" ON worker_salary_entries FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 17. Advances
CREATE TABLE advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL,
  person_type TEXT NOT NULL CHECK (person_type IN ('operator', 'worker')),
  date DATE NOT NULL,
  description TEXT,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "advances_policy" ON advances FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 18. Analytics Goals
CREATE TABLE analytics_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  billing_goal NUMERIC DEFAULT 0,
  UNIQUE(user_id, month)
);
ALTER TABLE analytics_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_policy" ON analytics_goals FOR ALL USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin')
);

-- 19. User Settings
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light',
  settings JSONB DEFAULT '{}'::jsonb
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_policy" ON user_settings FOR ALL USING (auth.uid() = user_id);
