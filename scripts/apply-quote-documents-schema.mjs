import postgres from "postgres";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error("Falta SUPABASE_DB_URL.");

const sql = postgres(connectionString, { ssl: "require", max: 1 });

try {
  await sql.begin(async (tx) => {
    await tx`alter table public.quotes add column if not exists document_data jsonb not null default '{}'::jsonb`;
    await tx`alter table public.quotes drop constraint if exists quotes_document_data_object_check`;
    await tx`alter table public.quotes add constraint quotes_document_data_object_check check (jsonb_typeof(document_data) = 'object')`;
    await tx`comment on column public.quotes.document_data is 'Datos editables del contrato, carta factura, forma de pago y facturación fiscal.'`;
  });

  const [column] = await sql`
    select column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name = 'quotes' and column_name = 'document_data'
  `;
  const [constraint] = await sql`
    select conname
    from pg_constraint
    where conrelid = 'public.quotes'::regclass and conname = 'quotes_document_data_object_check'
  `;
  if (!column || column.data_type !== "jsonb" || column.is_nullable !== "NO" || !constraint) {
    throw new Error("La verificación del esquema de documentos no pasó.");
  }
  console.log("Esquema de documentos verificado en public.quotes.");
} finally {
  await sql.end();
}
