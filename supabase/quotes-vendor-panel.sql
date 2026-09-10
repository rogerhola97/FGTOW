-- Ejecuta este archivo una sola vez en Supabase > SQL Editor.
--
-- 1) Corrige el bug real por el que NINGUNA cotización ni solicitud se estaba guardando:
--    el código manda un campo `state` en cada inserción, pero esa columna nunca se creó en
--    las tablas reales (la migración al final de quotes.sql/leads.sql no se había ejecutado
--    contra este proyecto). PostgREST rechazaba cada insert con
--    "Could not find the 'state' column ... in the schema cache" — el correo del cotizador sí
--    se mandaba (por eso llegaban correos) pero el registro nunca se guardaba en la base de
--    datos, y el sitio mostraba "No fue posible guardar o enviar la cotización".
-- 2) Agrega las columnas nuevas que necesita el panel de vendedor: modelo, versionado
--    (cotización nueva vs. edición de una existente) y quién de ventas la creó/editó.

alter table public.quotes add column if not exists state text not null default 'Nuevo León';
alter table public.quotes drop constraint if exists quotes_state_check;
alter table public.quotes add constraint quotes_state_check check (char_length(state) between 2 and 100);

alter table public.leads add column if not exists state text not null default 'Nuevo León';
alter table public.leads drop constraint if exists leads_state_check;
alter table public.leads add constraint leads_state_check check (char_length(state) between 2 and 100);

-- Modelo del remolque cotizado ("food" | "cargo" | "rzr"). Se guarda explícito para no tener
-- que adivinarlo a partir de trailer_preset al reabrir el plano en el panel de vendedor.
alter table public.quotes add column if not exists model text;
update public.quotes set model = 'food' where model is null;
alter table public.quotes alter column model set not null;
alter table public.quotes drop constraint if exists quotes_model_check;
alter table public.quotes add constraint quotes_model_check check (model in ('food', 'cargo', 'rzr'));

-- Versionado: una cotización nueva puede partir de una anterior del mismo cliente.
alter table public.quotes add column if not exists parent_quote_id bigint references public.quotes (id) on delete set null;
alter table public.quotes add column if not exists version integer not null default 1;
alter table public.quotes drop constraint if exists quotes_version_check;
alter table public.quotes add constraint quotes_version_check check (version >= 1);

-- Auditoría de edición desde el panel de vendedor.
alter table public.quotes add column if not exists updated_at timestamptz;
alter table public.quotes add column if not exists vendor_email text;
alter table public.quotes add column if not exists vendor_edited boolean not null default false;

create index if not exists quotes_parent_quote_id_idx on public.quotes (parent_quote_id);

-- El panel de vendedor guarda con source = 'vendor-panel' en vez de 'website-2d'.
alter table public.quotes drop constraint if exists quotes_source_check;
alter table public.quotes add constraint quotes_source_check check (source in ('website-2d', 'vendor-panel'));

comment on column public.quotes.parent_quote_id is 'Cotización anterior de la que partió esta versión (NULL si es la primera).';
comment on column public.quotes.vendor_edited is 'true si un vendedor la creó o editó desde /vendedor/clientes (no el cliente desde el sitio público).';
