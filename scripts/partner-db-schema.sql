-- Partner-siden (FACCI x ZAHAR): egen Neon-database "facci-partner".
-- Kør én gang mod PARTNER_DATABASE_URL.

-- Delt tilstand: én række pr. point/note (score:<idé>:<kriterie>, note:<idé|_general>)
CREATE TABLE IF NOT EXISTS partner_kv (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Gemte versioner (hele tilstanden som jsonb). kind = 'manual' | 'auto'
CREATE TABLE IF NOT EXISTS partner_versions (
  id bigserial PRIMARY KEY,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'manual',
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
