using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PosBackend.Infrastructure.Data;

#nullable disable

namespace PosBackend.Infrastructure.Data.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20240701000003_AddPurchasingAndProfitMetrics")]
    public partial class AddPurchasingAndProfitMetrics : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "average_cost_lbp",
                table: "inventories",
                type: "numeric(20,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "average_cost_usd",
                table: "inventories",
                type: "numeric(14,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "last_restocked_at",
                table: "inventories",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.DropColumn(
                name: "total_cost",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "currency",
                table: "purchase_orders");

            migrationBuilder.AddColumn<Guid>(
                name: "created_by_user_id",
                table: "purchase_orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "exchange_rate_used",
                table: "purchase_orders",
                type: "numeric(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "reference",
                table: "purchase_orders",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "received_at",
                table: "purchase_orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "total_cost_lbp",
                table: "purchase_orders",
                type: "numeric(20,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "total_cost_usd",
                table: "purchase_orders",
                type: "numeric(14,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "base_unit_price_lbp",
                table: "transaction_lines",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "base_unit_price_usd",
                table: "transaction_lines",
                type: "numeric(14,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "cost_lbp",
                table: "transaction_lines",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "cost_usd",
                table: "transaction_lines",
                type: "numeric(14,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "profit_lbp",
                table: "transaction_lines",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "profit_usd",
                table: "transaction_lines",
                type: "numeric(14,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "purchase_order_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PurchaseOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Barcode = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    UnitCostUsd = table.Column<decimal>(type: "numeric(14,4)", nullable: false),
                    UnitCostLbp = table.Column<decimal>(type: "numeric(20,2)", nullable: false),
                    TotalCostUsd = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    TotalCostLbp = table.Column<decimal>(type: "numeric(20,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_order_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_order_lines_products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_purchase_order_lines_purchase_orders_PurchaseOrderId",
                        column: x => x.PurchaseOrderId,
                        principalTable: "purchase_orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_purchase_orders_created_by_user_id",
                table: "purchase_orders",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_order_lines_ProductId",
                table: "purchase_order_lines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_order_lines_PurchaseOrderId",
                table: "purchase_order_lines",
                column: "PurchaseOrderId");

            migrationBuilder.AddForeignKey(
                name: "FK_purchase_orders_users_created_by_user_id",
                table: "purchase_orders",
                column: "created_by_user_id",
                principalTable: "users",
                principalColumn: "id");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_purchase_orders_users_created_by_user_id",
                table: "purchase_orders");

            migrationBuilder.DropTable(
                name: "purchase_order_lines");

            migrationBuilder.DropIndex(
                name: "IX_purchase_orders_created_by_user_id",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "average_cost_lbp",
                table: "inventories");

            migrationBuilder.DropColumn(
                name: "average_cost_usd",
                table: "inventories");

            migrationBuilder.DropColumn(
                name: "last_restocked_at",
                table: "inventories");

            migrationBuilder.DropColumn(
                name: "created_by_user_id",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "exchange_rate_used",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "reference",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "received_at",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "total_cost_lbp",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "total_cost_usd",
                table: "purchase_orders");

            migrationBuilder.DropColumn(
                name: "base_unit_price_lbp",
                table: "transaction_lines");

            migrationBuilder.DropColumn(
                name: "base_unit_price_usd",
                table: "transaction_lines");

            migrationBuilder.DropColumn(
                name: "cost_lbp",
                table: "transaction_lines");

            migrationBuilder.DropColumn(
                name: "cost_usd",
                table: "transaction_lines");

            migrationBuilder.DropColumn(
                name: "profit_lbp",
                table: "transaction_lines");

            migrationBuilder.DropColumn(
                name: "profit_usd",
                table: "transaction_lines");

            migrationBuilder.AddColumn<string>(
                name: "currency",
                table: "purchase_orders",
                type: "character varying(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "USD");

            migrationBuilder.AddColumn<decimal>(
                name: "total_cost",
                table: "purchase_orders",
                type: "numeric(14,2)",
                nullable: false,
                defaultValue: 0m);
        }
    }
}
