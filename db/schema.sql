-- MOVA — esquema PostgreSQL (alvo de produção).
-- O MVP roda com repositório em memória (src/repository) carregado da camada de dados brutos;
-- este esquema espelha os mesmos tipos (src/domain/types.ts) para a migração.

CREATE TYPE method_status AS ENUM ('CONFIRMADO', 'PENDENTE', 'EXPERIMENTAL');
CREATE TYPE quality_status AS ENUM ('VALIDO', 'AUSENTE', 'INVALIDO', 'SUSPEITO', 'INCOMPLETO');
CREATE TYPE data_source_kind AS ENUM ('HISTORICO', 'SIMULACAO', 'CAMERA');
CREATE TYPE value_origin AS ENUM ('OBSERVADO_NA_FONTE', 'CALCULADO', 'SIMULADO', 'INDISPONIVEL');

CREATE TABLE source_document (
  id              text PRIMARY KEY,
  title           text NOT NULL,
  file_name       text,
  kind            text NOT NULL CHECK (kind IN ('PRIMARIA', 'SECUNDARIA')),
  available       boolean NOT NULL DEFAULT false,
  description     text NOT NULL
);

CREATE TABLE corridor (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  address         text NOT NULL,
  reference       text,
  road_class_raw  text,
  lat             double precision,
  lng             double precision,
  coord_provenance text CHECK (coord_provenance IN ('APROXIMADO_FONTE_EXTERNA', 'FONTE_DOCUMENTAL', 'LEVANTAMENTO')),
  coord_note      text
);

-- Sentido / pista (uma linha da matriz).
CREATE TABLE approach (
  id               text PRIMARY KEY,
  corridor_id      text NOT NULL REFERENCES corridor(id),
  label            text NOT NULL,
  direction_raw    text NOT NULL,
  lanes_raw        text NOT NULL,
  lane_count       int CHECK (lane_count > 0),
  speed_record_raw text NOT NULL,
  notes_raw        text NOT NULL,
  source_document  text NOT NULL REFERENCES source_document(id),
  source_section   text NOT NULL,
  source_locator   text
);

-- Medidas agregadas reportadas em documentos (faixas).
CREATE TABLE measurement (
  id              text PRIMARY KEY,
  approach_id     text NOT NULL REFERENCES approach(id),
  metric          text NOT NULL CHECK (metric IN ('VDM_DIAS_UTEIS', 'VOLUME_FIM_DE_SEMANA', 'PICO_MANHA', 'PICO_TARDE_NOITE')),
  raw             text NOT NULL,           -- texto literal da fonte
  value_min       numeric,
  value_max       numeric,
  approximate     boolean NOT NULL DEFAULT false,
  unit            text,
  raw_unit        text,
  windows         jsonb NOT NULL DEFAULT '[]',
  qualifier       text,
  source_document text NOT NULL REFERENCES source_document(id),
  source_section  text NOT NULL,
  source_locator  text,
  CHECK (value_min IS NULL OR value_max IS NULL OR value_min <= value_max)
);

-- Observações primárias em intervalo (contagem / simulação / câmera).
CREATE TABLE traffic_observation (
  id               text PRIMARY KEY,
  approach_id      text NOT NULL REFERENCES approach(id),
  source           data_source_kind NOT NULL,
  interval_start   timestamptz NOT NULL,
  interval_end     timestamptz NOT NULL,
  vehicle_count    int,
  average_speed    numeric,
  quality          quality_status NOT NULL,
  raw_payload      jsonb,
  CHECK (interval_end > interval_start)
);
CREATE INDEX ON traffic_observation (approach_id, interval_start);

CREATE TABLE camera_observation_raw (
  id              bigserial PRIMARY KEY,
  camera_id       text NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  payload         jsonb NOT NULL,
  valid           boolean NOT NULL,
  approach_id     text REFERENCES approach(id)
);

CREATE TABLE methodology (
  id              text NOT NULL,
  version         text NOT NULL,
  name            text NOT NULL,
  description     text NOT NULL,
  formula         text,                    -- exatamente como na fonte; NULL se ausente
  implementation  text,
  variables       jsonb NOT NULL DEFAULT '[]',
  unit            text,
  purpose         text NOT NULL,
  sources         jsonb NOT NULL DEFAULT '[]',
  external_source text,
  status          method_status NOT NULL,
  gaps            jsonb NOT NULL DEFAULT '[]',
  PRIMARY KEY (id, version)
);

CREATE TABLE indicator_value (
  id                  text PRIMARY KEY,
  key                 text NOT NULL,
  approach_id         text NOT NULL REFERENCES approach(id),
  origin              value_origin NOT NULL,
  value_min           numeric,
  value_max           numeric,
  unit                text,
  period              text NOT NULL,
  methodology_id      text NOT NULL,
  methodology_version text NOT NULL,
  source_kind         data_source_kind NOT NULL,
  trace               jsonb NOT NULL,      -- passos Indicador → … → Interpretação
  computed_at         timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (methodology_id, methodology_version) REFERENCES methodology(id, version)
);

CREATE TABLE quality_issue (
  id              text PRIMARY KEY,
  status          quality_status NOT NULL,
  rule            text NOT NULL,
  target_kind     text NOT NULL,
  target_id       text NOT NULL,
  message         text NOT NULL,
  evidence        text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Parâmetros da condição operacional — vazio até validação metodológica.
CREATE TABLE condition_config (
  id              serial PRIMARY KEY,
  base_indicator  text,
  l_atencao       numeric,
  l_critico       numeric,
  l_congestionado numeric,
  status          text NOT NULL DEFAULT 'AGUARDANDO_VALIDACAO',
  source          text,
  CHECK (l_atencao < l_critico AND l_critico < l_congestionado)
);
