using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using PosBackend.Infrastructure.Data;

#nullable disable

namespace PosBackend.Infrastructure.Data.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    partial class ApplicationDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "8.0.0")
                .HasAnnotation("Relational:MaxIdentifierLength", 63);

            NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

            modelBuilder.Entity("PosBackend.Domain.Entities.AuditLog", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<string>("Action").HasMaxLength(120).HasColumnType("character varying(120)");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<string>("Data").HasColumnType("text");
                b.Property<string>("Entity").HasMaxLength(120).HasColumnType("character varying(120)");
                b.Property<Guid?>("EntityId").HasColumnType("uuid");
                b.Property<string>("IpAddress").HasColumnType("text");
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.Property<Guid>("UserId").HasColumnType("uuid");
                b.HasKey("Id");
                b.HasIndex("UserId");
                b.ToTable("audit_logs", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.Category", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<string>("Name").HasMaxLength(120).HasColumnType("character varying(120)");
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.HasKey("Id");
                b.ToTable("categories", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.CurrencyRate", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<string>("BaseCurrency").HasMaxLength(3).HasColumnType("character varying(3)");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<string>("Notes").HasColumnType("text");
                b.Property<decimal>("Rate").HasColumnType("numeric(18,6)");
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.Property<Guid?>("UserId").HasColumnType("uuid");
                b.Property<string>("QuoteCurrency").HasMaxLength(3).HasColumnType("character varying(3)");
                b.HasKey("Id");
                b.ToTable("currency_rates", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.ExpirationBatch", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<string>("BatchCode").HasColumnType("text");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<DateOnly>("ExpirationDate").HasColumnType("date");
                b.Property<Guid>("ProductId").HasColumnType("uuid");
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.Property<decimal>("Quantity").HasColumnType("numeric(14,2)");
                b.HasKey("Id");
                b.HasIndex("ProductId");
                b.ToTable("expiration_batches", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.Inventory", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<decimal>("AverageCostLbp").HasColumnType("numeric(20,2)");
                b.Property<decimal>("AverageCostUsd").HasColumnType("numeric(14,4)");
                b.Property<DateTimeOffset?>("LastRestockedAt").HasColumnType("timestamp with time zone");
                b.Property<bool>("IsReorderAlarmEnabled").HasColumnType("boolean");
                b.Property<Guid>("ProductId").HasColumnType("uuid");
                b.Property<decimal>("QuantityOnHand").HasColumnType("numeric(14,2)");
                b.Property<decimal>("ReorderPoint").HasColumnType("numeric(18,2)");
                b.Property<decimal>("ReorderQuantity").HasColumnType("numeric(18,2)");
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.HasKey("Id");
                b.HasIndex("ProductId").IsUnique();
                b.ToTable("inventories", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.PriceRule", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<decimal>("DiscountPercent").HasColumnType("numeric(5,2)");
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.Property<Guid>("ProductId").HasColumnType("uuid");
                b.Property<int>("RuleType").HasColumnType("integer");
                b.Property<DateTimeOffset>("StartDate").HasColumnType("timestamp with time zone");
                b.Property<DateTimeOffset?>("EndDate").HasColumnType("timestamp with time zone");
                b.Property<string>("Description").HasColumnType("text");
                b.Property<bool>("IsActive").HasColumnType("boolean");
                b.HasKey("Id");
                b.HasIndex("ProductId");
                b.ToTable("price_rules", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.StoreProfile", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<string>("Name").HasMaxLength(200).HasColumnType("character varying(200)");
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.HasKey("Id");
                b.ToTable("store_profiles", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.Product", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<string>("Barcode").HasColumnType("text");
                b.Property<Guid>("CategoryId").HasColumnType("uuid");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<string>("Description").HasColumnType("text");
                b.Property<bool>("IsActive").HasColumnType("boolean");
                b.Property<bool>("IsPinned").HasColumnName("is_pinned").HasColumnType("boolean").HasDefaultValue(false);
                b.Property<string>("Name").HasColumnType("text");
                b.Property<decimal>("PriceLbp").HasColumnType("numeric(14,2)");
                b.Property<decimal>("PriceUsd").HasColumnType("numeric(12,2)");
                b.Property<string>("Sku").HasColumnType("text").IsRequired(false);
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.HasKey("Id");
                b.HasIndex("Barcode").IsUnique();
                b.HasIndex("CategoryId");
                b.HasIndex("Sku").IsUnique().HasFilter("\"Sku\" IS NOT NULL");
                b.ToTable("products", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.PurchaseOrder", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<Guid?>("CreatedByUserId").HasColumnType("uuid");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<decimal>("ExchangeRateUsed").HasColumnType("numeric(18,4)");
                b.Property<DateTimeOffset?>("ExpectedAt").HasColumnType("timestamp with time zone");
                b.Property<DateTimeOffset>("OrderedAt").HasColumnType("timestamp with time zone");
                b.Property<string>("Reference").HasMaxLength(120).HasColumnType("character varying(120)");
                b.Property<DateTimeOffset?>("ReceivedAt").HasColumnType("timestamp with time zone");
                b.Property<int>("Status").HasColumnType("integer");
                b.Property<decimal>("TotalCostLbp").HasColumnType("numeric(20,2)");
                b.Property<decimal>("TotalCostUsd").HasColumnType("numeric(14,2)");
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.Property<Guid>("SupplierId").HasColumnType("uuid");
                b.HasKey("Id");
                b.HasIndex("CreatedByUserId");
                b.HasIndex("SupplierId");
                b.ToTable("purchase_orders", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.PurchaseOrderLine", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<string>("Barcode").HasMaxLength(128).HasColumnType("character varying(128)");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<Guid>("ProductId").HasColumnType("uuid");
                b.Property<Guid>("PurchaseOrderId").HasColumnType("uuid");
                b.Property<decimal>("Quantity").HasColumnType("numeric(14,2)");
                b.Property<decimal>("TotalCostLbp").HasColumnType("numeric(20,2)");
                b.Property<decimal>("TotalCostUsd").HasColumnType("numeric(14,2)");
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.Property<decimal>("UnitCostLbp").HasColumnType("numeric(20,2)");
                b.Property<decimal>("UnitCostUsd").HasColumnType("numeric(14,4)");
                b.HasKey("Id");
                b.HasIndex("ProductId");
                b.HasIndex("PurchaseOrderId");
                b.ToTable("purchase_order_lines", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.TransactionLine", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<decimal>("BaseUnitPriceLbp").HasColumnType("numeric(18,2)");
                b.Property<decimal>("BaseUnitPriceUsd").HasColumnType("numeric(14,2)");
                b.Property<decimal>("CostLbp").HasColumnType("numeric(18,2)");
                b.Property<decimal>("CostUsd").HasColumnType("numeric(14,4)");
                b.Property<decimal>("DiscountPercent").HasColumnType("numeric(5,2)");
                b.Property<Guid?>("PriceRuleId").HasColumnType("uuid");
                b.Property<Guid>("ProductId").HasColumnType("uuid");
                b.Property<decimal>("ProfitLbp").HasColumnType("numeric(18,2)");
                b.Property<decimal>("ProfitUsd").HasColumnType("numeric(14,2)");
                b.Property<decimal>("Quantity").HasColumnType("numeric(18,2)");
                b.Property<Guid>("TransactionId").HasColumnType("uuid");
                b.Property<decimal>("TotalLbp").HasColumnType("numeric(18,2)");
                b.Property<decimal>("TotalUsd").HasColumnType("numeric(14,2)");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.Property<decimal>("UnitPriceLbp").HasColumnType("numeric(18,2)");
                b.Property<decimal>("UnitPriceUsd").HasColumnType("numeric(14,2)");
                b.HasKey("Id");
                b.HasIndex("PriceRuleId");
                b.HasIndex("ProductId");
                b.HasIndex("TransactionId");
                b.ToTable("transaction_lines", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.PosTransaction", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<decimal>("BalanceLbp").HasColumnType("numeric(18,2)");
                b.Property<decimal>("BalanceUsd").HasColumnType("numeric(14,2)");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<decimal>("ExchangeRateUsed").HasColumnType("numeric(18,6)");
                b.Property<decimal>("PaidLbp").HasColumnType("numeric(18,2)");
                b.Property<decimal>("PaidUsd").HasColumnType("numeric(14,2)");
                b.Property<string>("ReceiptHtml").HasColumnType("text");
                b.Property<int>("Type").HasColumnType("integer");
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.Property<Guid>("UserId").HasColumnType("uuid");
                b.Property<decimal>("TotalLbp").HasColumnType("numeric(18,2)");
                b.Property<decimal>("TotalUsd").HasColumnType("numeric(14,2)");
                b.Property<string>("TransactionNumber").HasColumnType("text");
                b.HasKey("Id");
                b.HasIndex("TransactionNumber").IsUnique();
                b.HasIndex("UserId");
                b.ToTable("transactions", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.Supplier", b =>
            {
                b.Property<Guid>("Id").HasColumnType("uuid");
                b.Property<string>("ContactEmail").HasColumnType("text");
                b.Property<string>("ContactPhone").HasColumnType("text");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<string>("Name").HasMaxLength(180).HasColumnType("character varying(180)");
                b.Property<DateTime?>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.HasKey("Id");
                b.ToTable("suppliers", (string)null);
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.AuditLog", b =>
            {
                b.HasOne("PosBackend.Domain.Entities.User", "User")
                    .WithMany("AuditLogs")
                    .HasForeignKey("UserId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("User");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.ExpirationBatch", b =>
            {
                b.HasOne("PosBackend.Domain.Entities.Product", "Product")
                    .WithMany("ExpirationBatches")
                    .HasForeignKey("ProductId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Product");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.Inventory", b =>
            {
                b.HasOne("PosBackend.Domain.Entities.Product", "Product")
                    .WithOne("Inventory")
                    .HasForeignKey("PosBackend.Domain.Entities.Inventory", "ProductId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Product");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.PriceRule", b =>
            {
                b.HasOne("PosBackend.Domain.Entities.Product", "Product")
                    .WithMany("PriceRules")
                    .HasForeignKey("ProductId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Product");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.Product", b =>
            {
                b.HasOne("PosBackend.Domain.Entities.Category", "Category")
                    .WithMany("Products")
                    .HasForeignKey("CategoryId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Category");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.PurchaseOrder", b =>
            {
                b.HasOne("PosBackend.Domain.Entities.User", "CreatedByUser")
                    .WithMany("PurchaseOrders")
                    .HasForeignKey("CreatedByUserId");

                b.HasOne("PosBackend.Domain.Entities.Supplier", "Supplier")
                    .WithMany("PurchaseOrders")
                    .HasForeignKey("SupplierId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("CreatedByUser");
                b.Navigation("Supplier");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.PurchaseOrderLine", b =>
            {
                b.HasOne("PosBackend.Domain.Entities.Product", "Product")
                    .WithMany()
                    .HasForeignKey("ProductId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.HasOne("PosBackend.Domain.Entities.PurchaseOrder", "PurchaseOrder")
                    .WithMany("Lines")
                    .HasForeignKey("PurchaseOrderId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Product");
                b.Navigation("PurchaseOrder");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.TransactionLine", b =>
            {
                b.HasOne("PosBackend.Domain.Entities.PriceRule", "PriceRule")
                    .WithMany()
                    .HasForeignKey("PriceRuleId");

                b.HasOne("PosBackend.Domain.Entities.Product", "Product")
                    .WithMany()
                    .HasForeignKey("ProductId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.HasOne("PosBackend.Domain.Entities.PosTransaction", "Transaction")
                    .WithMany("Lines")
                    .HasForeignKey("TransactionId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("PriceRule");
                b.Navigation("Product");
                b.Navigation("Transaction");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.PosTransaction", b =>
            {
                b.HasOne("PosBackend.Domain.Entities.User", "User")
                    .WithMany("Transactions")
                    .HasForeignKey("UserId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("User");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.Category", b =>
            {
                b.Navigation("Products");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.PosTransaction", b =>
            {
                b.Navigation("Lines");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.Product", b =>
            {
                b.Navigation("ExpirationBatches");
                b.Navigation("Inventory");
                b.Navigation("PriceRules");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.PurchaseOrder", b =>
            {
                b.Navigation("CreatedByUser");
                b.Navigation("Lines");
                b.Navigation("Supplier");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.Supplier", b =>
            {
                b.Navigation("PurchaseOrders");
            });

            modelBuilder.Entity("PosBackend.Domain.Entities.User", b =>
            {
                b.Navigation("AuditLogs");
                b.Navigation("PurchaseOrders");
                b.Navigation("Transactions");
            });
#pragma warning restore 612, 618
        }
    }
}
