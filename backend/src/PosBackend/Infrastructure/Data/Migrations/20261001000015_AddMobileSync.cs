using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PosSync;

namespace PosBackend.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261001000015_AddMobileSync")]
public class AddMobileSync : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE mobile_sync_state (id integer PRIMARY KEY CHECK (id = 1), generation uuid NOT NULL,
                protected_link text NULL, last_success timestamptz NULL, last_error text NULL,
                revision bigint NOT NULL DEFAULT 0, pruned_through bigint NOT NULL DEFAULT 0);
            INSERT INTO mobile_sync_state(id, generation) VALUES (1, gen_random_uuid());
            CREATE TABLE mobile_sync_outbox (sequence bigserial PRIMARY KEY, transaction_id bigint NOT NULL,
                table_name text NOT NULL, record_id uuid NOT NULL, deleted boolean NOT NULL, row_data jsonb NULL);
            CREATE INDEX ON mobile_sync_outbox(transaction_id);
            CREATE FUNCTION aurora_sync_lock() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN PERFORM pg_advisory_xact_lock(194071,1); RETURN NULL; END $$;
            CREATE FUNCTION aurora_sync_capture() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE payload jsonb; entity_id uuid; next_sequence bigint;
            BEGIN
                -- Serialize sync sequence allocation through commit. Sequence gaps after rollback are valid.
                PERFORM pg_advisory_xact_lock(194071, 1);
                IF (SELECT protected_link IS NULL FROM mobile_sync_state WHERE id=1) THEN
                    next_sequence := nextval('mobile_sync_outbox_sequence_seq');
                    UPDATE mobile_sync_state SET revision=next_sequence,pruned_through=next_sequence WHERE id=1;
                    RETURN NULL;
                END IF;
                IF TG_OP = 'DELETE' THEN payload := to_jsonb(OLD); ELSE payload := to_jsonb(NEW); END IF;
                entity_id := (payload->>'Id')::uuid;
                IF TG_TABLE_NAME = 'users' THEN
                    payload := jsonb_build_object('Id',payload->'Id','Username',payload->'Username',
                        'DisplayName',payload->'DisplayName','Role',payload->'Role',
                        'CreatedAt',payload->'CreatedAt','UpdatedAt',payload->'UpdatedAt');
                ELSIF TG_TABLE_NAME = 'audit_logs' THEN payload := payload - 'Data' - 'IpAddress'; END IF;
                INSERT INTO mobile_sync_outbox(transaction_id,table_name,record_id,deleted,row_data)
                VALUES (txid_current(),TG_TABLE_NAME,entity_id,TG_OP = 'DELETE',
                    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE payload END);
                UPDATE mobile_sync_state SET revision = currval('mobile_sync_outbox_sequence_seq') WHERE id = 1;
                RETURN NULL;
            END $$;
            """);
        foreach (var table in SyncCatalog.Tables)
        {
            migrationBuilder.Sql($"CREATE TRIGGER aurora_sync_lock BEFORE INSERT OR UPDATE OR DELETE ON {table} FOR EACH STATEMENT EXECUTE FUNCTION aurora_sync_lock();");
            migrationBuilder.Sql($"CREATE TRIGGER aurora_sync AFTER INSERT OR UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION aurora_sync_capture();");
        }
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        foreach (var table in SyncCatalog.Tables) migrationBuilder.Sql($"DROP TRIGGER aurora_sync ON {table}; DROP TRIGGER aurora_sync_lock ON {table};");
        migrationBuilder.Sql("DROP FUNCTION aurora_sync_capture(); DROP FUNCTION aurora_sync_lock(); DROP TABLE mobile_sync_outbox; DROP TABLE mobile_sync_state;");
    }
}
