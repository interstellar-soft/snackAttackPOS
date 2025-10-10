using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PosBackend.Infrastructure.Data;

#nullable disable

namespace PosBackend.Infrastructure.Data.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20250325000008_AddOffers")]
    public partial class AddOffers : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "offers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    PriceUsd = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    PriceLbp = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_offers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "offer_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OfferId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(14,3)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_offer_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_offer_items_offers_OfferId",
                        column: x => x.OfferId,
                        principalTable: "offers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_offer_items_products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddColumn<Guid>(
                name: "OfferId",
                table: "transaction_lines",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_offer_items_OfferId_ProductId",
                table: "offer_items",
                columns: new[] { "OfferId", "ProductId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_offer_items_ProductId",
                table: "offer_items",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_transaction_lines_OfferId",
                table: "transaction_lines",
                column: "OfferId");

            migrationBuilder.AddForeignKey(
                name: "FK_transaction_lines_offers_OfferId",
                table: "transaction_lines",
                column: "OfferId",
                principalTable: "offers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_transaction_lines_offers_OfferId",
                table: "transaction_lines");

            migrationBuilder.DropTable(
                name: "offer_items");

            migrationBuilder.DropTable(
                name: "offers");

            migrationBuilder.DropIndex(
                name: "IX_transaction_lines_OfferId",
                table: "transaction_lines");

            migrationBuilder.DropColumn(
                name: "OfferId",
                table: "transaction_lines");
        }
    }
}
