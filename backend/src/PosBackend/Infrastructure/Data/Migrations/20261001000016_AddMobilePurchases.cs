using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace PosBackend.Infrastructure.Data.Migrations;
[DbContext(typeof(ApplicationDbContext)), Migration("20261001000016_AddMobilePurchases")]
public class AddMobilePurchases : Migration
{
    protected override void Up(MigrationBuilder m) => m.Sql("CREATE TABLE mobile_applied_commands (id uuid PRIMARY KEY, result text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());");
    protected override void Down(MigrationBuilder m) => m.Sql("DROP TABLE mobile_applied_commands;");
}
