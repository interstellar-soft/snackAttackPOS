using Microsoft.EntityFrameworkCore;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data;

public static class SeedData
{
    public static async Task InitializeAsync(ApplicationDbContext db, CancellationToken cancellationToken = default)
    {
        if (db.Database.IsRelational())
        {
            await db.Database.MigrateAsync(cancellationToken);
        }
        else
        {
            await db.Database.EnsureCreatedAsync(cancellationToken);
        }

        if (!await db.Users.AnyAsync(cancellationToken))
        {
            var admin = new User
            {
                Username = "admin",
                DisplayName = "Admin",
                Role = UserRole.Admin,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("ChangeMe123!")
            };

            var manager = new User
            {
                Username = "manager",
                DisplayName = "Store Manager",
                Role = UserRole.Manager,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("ChangeMe123!")
            };

            var cashier = new User
            {
                Username = "cashier",
                DisplayName = "Cashier",
                Role = UserRole.Cashier,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("ChangeMe123!")
            };

            await db.Users.AddRangeAsync(new[] { admin, manager, cashier }, cancellationToken);
        }

        if (!await db.Categories.AnyAsync(cancellationToken))
        {
            var categories = new[]
            {
                new Category { Name = "Produce" },
                new Category { Name = "Dairy" },
                new Category { Name = "Bakery" },
                new Category { Name = "Pantry" },
                new Category { Name = "Beverages" },
                new Category { Name = "Household" }
            };
            await db.Categories.AddRangeAsync(categories, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);

            var random = new Random(42);
            var products = new List<Product>();
            var expirationBatches = new List<ExpirationBatch>();
            var inventories = new List<Inventory>();

            foreach (var category in categories)
            {
                for (int i = 1; i <= 12; i++)
                {
                    var prefix = category.Name[..Math.Min(3, category.Name.Length)].ToUpper();
                    var sku = $"{prefix}-{i:000}";
                    var priceUsd = Math.Round((decimal)(random.NextDouble() * 20 + 1), 2);
                    var product = new Product
                    {
                        CategoryId = category.Id,
                        Name = $"{category.Name} Item {i}",
                        Sku = sku,
                        Barcode = random.NextInt64(1000000000000, 9999999999999).ToString(),
                        PriceUsd = priceUsd,
                        PriceLbp = priceUsd * 90000m,
                        Description = $"Sample {category.Name} product {i}",
                        IsPinned = i == 1
                    };
                    products.Add(product);

                    var batchCount = random.Next(1, 3);
                    for (int b = 0; b < batchCount; b++)
                    {
                        expirationBatches.Add(new ExpirationBatch
                        {
                            Product = product,
                            BatchCode = $"{sku}-B{b + 1}",
                            ExpirationDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(random.Next(5, 60))),
                            Quantity = random.Next(5, 40)
                        });
                    }

                    inventories.Add(new Inventory
                    {
                        Product = product,
                        QuantityOnHand = random.Next(10, 120),
                        ReorderPoint = 15,
                        ReorderQuantity = 50
                    });
                }
            }

            await db.Products.AddRangeAsync(products, cancellationToken);
            await db.ExpirationBatches.AddRangeAsync(expirationBatches, cancellationToken);
            await db.Inventories.AddRangeAsync(inventories, cancellationToken);
        }

        if (!await db.CurrencyRates.AnyAsync(cancellationToken))
        {
            await db.CurrencyRates.AddAsync(new CurrencyRate
            {
                BaseCurrency = "USD",
                QuoteCurrency = "LBP",
                Rate = 90000m,
                Notes = "Seed default rate"
            }, cancellationToken);
        }

        if (!await db.StoreProfiles.AnyAsync(cancellationToken))
        {
            await db.StoreProfiles.AddAsync(new StoreProfile
            {
                Name = "Aurora Market"
            }, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
