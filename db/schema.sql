-- MOVA — esquema PostgreSQL (alvo de produção).
-- O MVP roda com repositório em memória (src/repository) carregado da camada de dados brutos;
-- este esquema espelha os mesmos tipos (src/domain/types.ts) para a migração.

CREATE TYPE method_status AS ENUM ('CONFIRMADO', 'INFERIDO', 'EXPERIMENTAL', 'PENDENTE');
CREATE TYPE quality_status AS ENUM ('VALIDO', 'AUSENTE', 'INVALIDO', 'SUSPEITO', 'INCOMPLETO');
CREATE TYPE data_source_kind AS ENUM ('HISTORICO', 'SIMULACAO', 'CAMERA_TESTE');
CREATE TYPE value_origin AS ENUM ('OBSERVADO', 'CALCULADO', 'INTERPRETADO', 'SIMULADO', 'INDISPONIVEL');

CREATE TABLE source_document (
  id              text PRIMARY KEY,
  title           text NOT NULL,
  file_name       text,
  kind            text NOT NULL CHECK (kind IN ('PRIMARIA', 'SECUNDARIA', 'ESPECIFICACAO')),
  available       boolean NOT NULL DEFAULT false,
  description     text NOT NULL
);

CREATE TYPE day_type AS ENUM ('DIA_UTIL', 'SABADO', 'DOMINGO', 'DESCONHECIDO');

CREATE TABLE corridor (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  description     text NOT NULL DEFAULT ''
);

CREATE TABLE location (
  id               text PRIMARY KEY,
  corridor_id      text NOT NULL REFERENCES corridor(id),
  address          text NOT NULL,
  reference        text,
  road_class_raw   text,
  lat              double precision,
  lng              double precision,
  coord_provenance text CHECK (coord_provenance IN ('APROXIMADO_FONTE_EXTERNA', 'FONTE_DOCUMENTAL')),
  coord_note       text
);

-- Sentido + pista + conjunto de faixas monitoradas.
CREATE TABLE road_segment (
  id                  text PRIMARY KEY,
  location_id         text NOT NULL REFERENCES location(id),
  direction           text NOT NULL,
  carriageway         text NOT NULL CHECK (carriageway IN ('CENTRAL','LATERAL','CENTRAL_E_LATERAL','EXCLUSIVA_BRT','VIA_EXPRESSA','NAO_ESPECIFICADA')),
  lane_type           text NOT NULL CHECK (lane_type IN ('MISTA','BRT','MISTA_E_BRT','NAO_ESPECIFICADO')),
  lane_count          int CHECK (lane_count > 0),
  lanes_monitored_raw text NOT NULL,
  direction_raw       text NOT NULL,
  speed_record_raw    text NOT NULL,
  notes_raw           text NOT NULL,
  structure_note      text,
  source_document     text NOT NULL REFERENCES source_document(id),
  source_section      text NOT NULL,
  source_locator      text
);

-- Faixas agregadas reportadas em documentos.
CREATE TABLE measurement (
  id              text PRIMARY KEY,
  segment_id      text NOT NULL REFERENCES road_segment(id),
  metric          text NOT NULL CHECK (metric IN ('VDM_DIAS_UTEIS', 'VOLUME_FIM_DE_SEMANA', 'PICO_MANHA', 'PICO_TARDE_NOITE')),
  raw             text NOT NULL,
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

CREATE TABLE series (
  id              text PRIMARY KEY,
  segment_id      text NOT NULL REFERENCES road_segment(id),
  source          data_source_kind NOT NULL,
  label           text NOT NULL,
  obs_date        date,                    -- NULL quando a fonte não informa o dia
  obs_month       char(7),
  weekday         smallint CHECK (weekday BETWEEN 0 AND 6),
  day_type        day_type NOT NULL,
  source_document text REFERENCES source_document(id),
  source_section  text,
  source_locator  text
);

-- Observações em intervalo: HISTÓRICO, SIMULAÇÃO e CÂMERA DE TESTE usam a mesma tabela.
CREATE TABLE traffic_observation (
  id               text PRIMARY KEY,
  series_id        text NOT NULL REFERENCES series(id),
  segment_id       text NOT NULL REFERENCES road_segment(id),
  source           data_source_kind NOT NULL,
  start_time       time NOT NULL,
  duration_minutes numeric NOT NULL CHECK (duration_minutes > 0),
  vehicle_count    int,
  average_speed    numeric,
  p85_speed        numeric,
  queue_length_m   numeric,
  quality          quality_status NOT NULL,
  raw              text,
  source_locator   text
);
CREATE INDEX ON traffic_observation (segment_id, series_id, start_time);

CREATE TABLE camera_observation_raw (
  id              bigserial PRIMARY KEY,
  camera_id       text NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  payload         jsonb NOT NULL,
  valid           boolean NOT NULL,
  segment_id      text REFERENCES road_segment(id)
);

CREATE TABLE methodology (
  id              text NOT NULL,
  version         text NOT NULL,
  name            text NOT NULL,
  category        text NOT NULL CHECK (category IN ('DADO','INDICADOR','FORMULA','REGRA','INTERPRETACAO','HIPOTESE')),
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
  segment_id          text NOT NULL REFERENCES road_segment(id),
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
