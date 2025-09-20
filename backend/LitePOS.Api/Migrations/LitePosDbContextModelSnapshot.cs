using System;
using LitePOS.Api.Data;
using LitePOS.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

#nullable disable

namespace LitePOS.Api.Migrations
{
    [DbContext(typeof(LitePosDbContext))]
    partial class LitePosDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .UseCollation("utf8mb4_unicode_ci")
                .HasAnnotation("ProductVersion", "8.0.0")
                .HasAnnotation("Relational:MaxIdentifierLength", 64);

            MySqlModelBuilderExtensions.HasCharSet(modelBuilder, "utf8mb4");

            modelBuilder.Entity("LitePOS.Api.Entities.AppUser", b =>
            {
                b.Property<Guid>("Id")
                    .HasColumnType("char(36)");

                b.Property<string>("Email")
                    .IsRequired()
                    .HasMaxLength(160)
                    .HasColumnType("varchar(160)");

                b.Property<string>("FullName")
                    .IsRequired()
                    .HasMaxLength(120)
                    .HasColumnType("varchar(120)");

                b.Property<string>("PasswordHash")
                    .IsRequired()
                    .HasColumnType("longtext");

                b.Property<int>("Role")
                    .HasColumnType("int");

                b.HasKey("Id");

                b.HasIndex("Email")
                    .IsUnique();

                b.ToTable("Users");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.Category", b =>
            {
                b.Property<Guid>("Id")
                    .HasColumnType("char(36)");

                b.Property<string>("Description")
                    .HasMaxLength(240)
                    .HasColumnType("varchar(240)");

                b.Property<bool>("IsActive")
                    .HasColumnType("tinyint(1)");

                b.Property<string>("Name")
                    .IsRequired()
                    .HasMaxLength(120)
                    .HasColumnType("varchar(120)");

                b.HasKey("Id");

                b.ToTable("Categories");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.Customer", b =>
            {
                b.Property<Guid>("Id")
                    .HasColumnType("char(36)");

                b.Property<string>("Email")
                    .HasMaxLength(160)
                    .HasColumnType("varchar(160)");

                b.Property<string>("Name")
                    .IsRequired()
                    .HasMaxLength(160)
                    .HasColumnType("varchar(160)");

                b.Property<string>("Notes")
                    .HasMaxLength(500)
                    .HasColumnType("varchar(500)");

                b.Property<string>("Phone")
                    .HasMaxLength(80)
                    .HasColumnType("varchar(80)");

                b.HasKey("Id");

                b.ToTable("Customers");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.InventoryAdjustment", b =>
            {
                b.Property<Guid>("Id")
                    .HasColumnType("char(36)");

                b.Property<Guid?>("CreatedById")
                    .HasColumnType("char(36)");

                b.Property<DateTime>("CreatedAt")
                    .HasColumnType("datetime(6)");

                b.Property<string>("Note")
                    .HasColumnType("longtext");

                b.Property<Guid>("ProductId")
                    .HasColumnType("char(36)");

                b.Property<decimal>("QuantityChange")
                    .HasPrecision(18, 3)
                    .HasColumnType("decimal(18,3)");

                b.Property<string>("Reason")
                    .IsRequired()
                    .HasColumnType("longtext");

                b.HasKey("Id");

                b.HasIndex("CreatedById");

                b.HasIndex("ProductId");

                b.ToTable("InventoryAdjustments");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.Product", b =>
            {
                b.Property<Guid>("Id")
                    .HasColumnType("char(36)");

                b.Property<string>("Barcode")
                    .HasMaxLength(64)
                    .HasColumnType("varchar(64)");

                b.Property<Guid>("CategoryId")
                    .HasColumnType("char(36)");

                b.Property<DateTime>("CreatedAt")
                    .HasColumnType("datetime(6)");

                b.Property<decimal>("Cost")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<string>("Description")
                    .HasMaxLength(500)
                    .HasColumnType("varchar(500)");

                b.Property<string>("ImageUrl")
                    .HasColumnType("longtext");

                b.Property<bool>("IsActive")
                    .HasColumnType("tinyint(1)");

                b.Property<decimal>("LowStockThreshold")
                    .HasPrecision(18, 3)
                    .HasColumnType("decimal(18,3)");

                b.Property<string>("Name")
                    .IsRequired()
                    .HasMaxLength(160)
                    .HasColumnType("varchar(160)");

                b.Property<decimal>("Price")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<string>("Sku")
                    .IsRequired()
                    .HasMaxLength(64)
                    .HasColumnType("varchar(64)");

                b.Property<decimal>("StockQuantity")
                    .HasPrecision(18, 3)
                    .HasColumnType("decimal(18,3)");

                b.Property<string>("TaxClass")
                    .IsRequired()
                    .HasMaxLength(50)
                    .HasColumnType("varchar(50)");

                b.Property<decimal>("TaxRate")
                    .HasPrecision(6, 4)
                    .HasColumnType("decimal(6,4)");

                b.Property<DateTime>("UpdatedAt")
                    .HasColumnType("datetime(6)");

                b.HasKey("Id");

                b.HasIndex("CategoryId");

                b.HasIndex("Sku");

                b.ToTable("Products");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.ProductModifier", b =>
            {
                b.Property<Guid>("Id")
                    .HasColumnType("char(36)");

                b.Property<string>("Name")
                    .IsRequired()
                    .HasColumnType("longtext");

                b.Property<decimal>("PriceDelta")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<Guid>("ProductId")
                    .HasColumnType("char(36)");

                b.HasKey("Id");

                b.HasIndex("ProductId");

                b.ToTable("ProductModifiers");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.ProductVariant", b =>
            {
                b.Property<Guid>("Id")
                    .HasColumnType("char(36)");

                b.Property<string>("Barcode")
                    .HasColumnType("longtext");

                b.Property<string>("Name")
                    .IsRequired()
                    .HasColumnType("longtext");

                b.Property<decimal>("Price")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<Guid>("ProductId")
                    .HasColumnType("char(36)");

                b.Property<string>("Sku")
                    .HasColumnType("longtext");

                b.HasKey("Id");

                b.HasIndex("ProductId");

                b.ToTable("ProductVariants");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.RefreshToken", b =>
            {
                b.Property<Guid>("Id")
                    .HasColumnType("char(36)");

                b.Property<Guid>("AppUserId")
                    .HasColumnType("char(36)");

                b.Property<DateTime>("CreatedAt")
                    .HasColumnType("datetime(6)");

                b.Property<DateTime>("ExpiresAt")
                    .HasColumnType("datetime(6)");

                b.Property<DateTime?>("RevokedAt")
                    .HasColumnType("datetime(6)");

                b.Property<string>("Token")
                    .IsRequired()
                    .HasColumnType("longtext");

                b.HasKey("Id");

                b.HasIndex("AppUserId");

                b.ToTable("RefreshTokens");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.Sale", b =>
            {
                b.Property<Guid>("Id")
                    .HasColumnType("char(36)");

                b.Property<decimal>("CardPayment")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<decimal>("CashPayment")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<DateTime>("CreatedAt")
                    .HasColumnType("datetime(6)");

                b.Property<Guid>("CreatedById")
                    .HasColumnType("char(36)");

                b.Property<Guid?>("CustomerId")
                    .HasColumnType("char(36)");

                b.Property<decimal>("DiscountTotal")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<decimal>("ChangeDue")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<string>("Notes")
                    .HasColumnType("longtext");

                b.Property<decimal>("Subtotal")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<string>("SaleNumber")
                    .IsRequired()
                    .HasColumnType("longtext");

                b.Property<decimal>("TaxTotal")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<decimal>("Total")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.HasKey("Id");

                b.HasIndex("CreatedById");

                b.HasIndex("CustomerId");

                b.ToTable("Sales");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.SaleItem", b =>
            {
                b.Property<Guid>("Id")
                    .HasColumnType("char(36)");

                b.Property<string>("Barcode")
                    .HasColumnType("longtext");

                b.Property<decimal>("DiscountPercent")
                    .HasPrecision(5, 2)
                    .HasColumnType("decimal(5,2)");

                b.Property<decimal>("LineTotal")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<string>("ModifierName")
                    .HasColumnType("longtext");

                b.Property<string>("Note")
                    .HasColumnType("longtext");

                b.Property<Guid>("ProductId")
                    .HasColumnType("char(36)");

                b.Property<string>("ProductName")
                    .IsRequired()
                    .HasColumnType("longtext");

                b.Property<Guid>("SaleId")
                    .HasColumnType("char(36)");

                b.Property<string>("Sku")
                    .HasColumnType("longtext");

                b.Property<decimal>("TaxAmount")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<decimal>("Quantity")
                    .HasPrecision(18, 3)
                    .HasColumnType("decimal(18,3)");

                b.Property<decimal>("UnitPrice")
                    .HasPrecision(18, 2)
                    .HasColumnType("decimal(18,2)");

                b.Property<string>("VariantName")
                    .HasColumnType("longtext");

                b.HasKey("Id");

                b.HasIndex("ProductId");

                b.HasIndex("SaleId");

                b.ToTable("SaleItems");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.StoreSetting", b =>
            {
                b.Property<int>("Id")
                    .ValueGeneratedOnAdd()
                    .HasColumnType("int")
                    .HasAnnotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn);

                b.Property<string>("Address")
                    .HasColumnType("longtext");

                b.Property<string>("Currency")
                    .IsRequired()
                    .HasColumnType("longtext");

                b.Property<decimal>("DefaultTaxRate")
                    .HasPrecision(6, 4)
                    .HasColumnType("decimal(6,4)");

                b.Property<string>("Phone")
                    .HasColumnType("longtext");

                b.Property<string>("ReceiptFooter")
                    .IsRequired()
                    .HasColumnType("longtext");

                b.Property<string>("ReceiptHeader")
                    .IsRequired()
                    .HasColumnType("longtext");

                b.Property<string>("StoreName")
                    .IsRequired()
                    .HasColumnType("longtext");

                b.HasKey("Id");

                b.ToTable("StoreSettings");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.InventoryAdjustment", b =>
            {
                b.HasOne("LitePOS.Api.Entities.AppUser", "CreatedBy")
                    .WithMany()
                    .HasForeignKey("CreatedById");

                b.HasOne("LitePOS.Api.Entities.Product", "Product")
                    .WithMany("Adjustments")
                    .HasForeignKey("ProductId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("CreatedBy");

                b.Navigation("Product");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.Product", b =>
            {
                b.HasOne("LitePOS.Api.Entities.Category", "Category")
                    .WithMany("Products")
                    .HasForeignKey("CategoryId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Category");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.ProductModifier", b =>
            {
                b.HasOne("LitePOS.Api.Entities.Product", "Product")
                    .WithMany("Modifiers")
                    .HasForeignKey("ProductId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Product");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.ProductVariant", b =>
            {
                b.HasOne("LitePOS.Api.Entities.Product", "Product")
                    .WithMany("Variants")
                    .HasForeignKey("ProductId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Product");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.RefreshToken", b =>
            {
                b.HasOne("LitePOS.Api.Entities.AppUser", "AppUser")
                    .WithMany("RefreshTokens")
                    .HasForeignKey("AppUserId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("AppUser");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.Sale", b =>
            {
                b.HasOne("LitePOS.Api.Entities.AppUser", "CreatedBy")
                    .WithMany()
                    .HasForeignKey("CreatedById")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.HasOne("LitePOS.Api.Entities.Customer", "Customer")
                    .WithMany("Sales")
                    .HasForeignKey("CustomerId");

                b.Navigation("CreatedBy");

                b.Navigation("Customer");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.SaleItem", b =>
            {
                b.HasOne("LitePOS.Api.Entities.Product", "Product")
                    .WithMany()
                    .HasForeignKey("ProductId");

                b.HasOne("LitePOS.Api.Entities.Sale", "Sale")
                    .WithMany("Items")
                    .HasForeignKey("SaleId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Product");

                b.Navigation("Sale");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.AppUser", b =>
            {
                b.Navigation("RefreshTokens");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.Category", b =>
            {
                b.Navigation("Products");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.Customer", b =>
            {
                b.Navigation("Sales");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.Product", b =>
            {
                b.Navigation("Adjustments");

                b.Navigation("Modifiers");

                b.Navigation("Variants");
            });

            modelBuilder.Entity("LitePOS.Api.Entities.Sale", b =>
            {
                b.Navigation("Items");
            });
#pragma warning restore 612, 618
        }
    }
}
