using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PosBackend.Infrastructure.Data;

#nullable disable

namespace PosBackend.Infrastructure.Data.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20250215000000_SetDefaultInventoryReorderPoint")]
    public partial class SetDefaultInventoryReorderPoint : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"inventories\" SET \"IsReorderAlarmEnabled\" = TRUE WHERE \"ReorderPoint\" = 0 AND \"IsReorderAlarmEnabled\" = FALSE;");
            migrationBuilder.Sql("UPDATE \"inventories\" SET \"ReorderPoint\" = 3 WHERE \"ReorderPoint\" = 0;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"inventories\" SET \"ReorderPoint\" = 0, \"IsReorderAlarmEnabled\" = FALSE WHERE \"ReorderPoint\" = 3;");
        }
    }
}
