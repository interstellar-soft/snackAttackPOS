using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PosBackend.Infrastructure.Data;

#nullable disable

namespace PosBackend.Infrastructure.Data.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20250320000007_AddManualPricingAndPersonalPurchases")]
    public partial class AddManualPricingAndPersonalPurchases : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasManualTotalOverride",
                table: "transactions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "HasManualPriceOverride",
                table: "transaction_lines",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "personal_purchases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TotalUsd = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    TotalLbp = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PurchaseDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_personal_purchases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_personal_purchases_transactions_TransactionId",
                        column: x => x.TransactionId,
                        principalTable: "transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_personal_purchases_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_personal_purchases_TransactionId",
                table: "personal_purchases",
                column: "TransactionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_personal_purchases_UserId_PurchaseDate",
                table: "personal_purchases",
                columns: new[] { "UserId", "PurchaseDate" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "personal_purchases");

            migrationBuilder.DropColumn(
                name: "HasManualTotalOverride",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "HasManualPriceOverride",
                table: "transaction_lines");
        }
    }
}
