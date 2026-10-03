using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PosBackend.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261001000014_PreserveFractionalStock")]
public class PreserveFractionalStock : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        foreach (var table in new[] { "purchase_order_lines", "expiration_batches" })
            migrationBuilder.AlterColumn<decimal>(name: "Quantity", table: table,
                type: "numeric(14,3)", nullable: false, oldClrType: typeof(decimal), oldType: "numeric(14,2)");
        migrationBuilder.AlterColumn<decimal>(name: "QuantityOnHand", table: "inventories",
            type: "numeric(14,3)", nullable: false, oldClrType: typeof(decimal), oldType: "numeric(14,2)");
        migrationBuilder.AlterColumn<decimal>(name: "Quantity", table: "transaction_lines",
            type: "numeric(18,3)", nullable: false, oldClrType: typeof(decimal), oldType: "numeric(18,2)");
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        foreach (var table in new[] { "purchase_order_lines", "expiration_batches" })
            migrationBuilder.AlterColumn<decimal>(name: "Quantity", table: table,
                type: "numeric(14,2)", nullable: false, oldClrType: typeof(decimal), oldType: "numeric(14,3)");
        migrationBuilder.AlterColumn<decimal>(name: "QuantityOnHand", table: "inventories",
            type: "numeric(14,2)", nullable: false, oldClrType: typeof(decimal), oldType: "numeric(14,3)");
        migrationBuilder.AlterColumn<decimal>(name: "Quantity", table: "transaction_lines",
            type: "numeric(18,2)", nullable: false, oldClrType: typeof(decimal), oldType: "numeric(18,3)");
    }
}
