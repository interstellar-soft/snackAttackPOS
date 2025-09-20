using BCrypt.Net;
using LitePOS.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Data;

public class DatabaseInitializer
{
    private readonly LitePosDbContext _dbContext;

    public DatabaseInitializer(LitePosDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task InitialiseAsync()
    {
        await _dbContext.Database.MigrateAsync();
    }

    public async Task SeedAsync()
    {
        if (!await _dbContext.Users.AnyAsync())
        {
            var admin = new AppUser
            {
                Id = Guid.NewGuid(),
                FullName = "Ada Lovelace",
                Email = "admin@litepos.dev",
                Role = UserRole.Admin,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
            };
            var manager = new AppUser
            {
                Id = Guid.NewGuid(),
                FullName = "Grace Hopper",
                Email = "manager@litepos.dev",
                Role = UserRole.Manager,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Manager123!"),
            };
            var cashier = new AppUser
            {
                Id = Guid.NewGuid(),
                FullName = "Alan Turing",
                Email = "cashier@litepos.dev",
                Role = UserRole.Cashier,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Cashier123!"),
            };

            await _dbContext.Users.AddRangeAsync(admin, manager, cashier);
        }

        if (!await _dbContext.StoreSettings.AnyAsync())
        {
            await _dbContext.StoreSettings.AddAsync(new StoreSetting
            {
                Id = 1,
                StoreName = "LitePOS Demo Store",
                Currency = "USD",
                DefaultTaxRate = 0.075m,
                ReceiptHeader = "LitePOS Demo Store\n123 Demo Street",
                ReceiptFooter = "Come again soon!"
            });
        }

        if (!await _dbContext.Categories.AnyAsync())
        {
            var categories = new List<Category>
            {
                new() { Id = Guid.NewGuid(), Name = "Coffee" },
                new() { Id = Guid.NewGuid(), Name = "Bakery" },
                new() { Id = Guid.NewGuid(), Name = "Snacks" },
                new() { Id = Guid.NewGuid(), Name = "Bottled Drinks" }
            };
            await _dbContext.Categories.AddRangeAsync(categories);

            var random = new Random();
            var now = DateTime.UtcNow;
            var products = new List<Product>();
            int skuCounter = 1000;
            foreach (var category in categories)
            {
                for (int i = 0; i < 15; i++)
                {
                    var id = Guid.NewGuid();
                    var price = Math.Round((decimal)(random.NextDouble() * 15 + 2), 2);
                    var cost = Math.Round(price * 0.55m, 2);
                    products.Add(new Product
                    {
                        Id = id,
                        CategoryId = category.Id,
                        Name = $"{category.Name} Item {i + 1}",
                        Sku = $"SKU{skuCounter + i}",
                        Barcode = $"BC{skuCounter + i:000000}",
                        Description = "Sample seeded product",
                        Price = price,
                        Cost = cost,
                        TaxClass = "Standard",
                        StockQuantity = random.Next(10, 80),
                        LowStockThreshold = 5,
                        TaxRate = 0.075m,
                        CreatedAt = now,
                        UpdatedAt = now,
                    });
                }
                skuCounter += 20;
            }

            await _dbContext.Products.AddRangeAsync(products);
        }

        if (!await _dbContext.Customers.AnyAsync())
        {
            await _dbContext.Customers.AddRangeAsync(new List<Customer>
            {
                new() { Id = Guid.NewGuid(), Name = "Jamie Rivera", Email = "jamie@example.com", Phone = "555-0001" },
                new() { Id = Guid.NewGuid(), Name = "Morgan Lee", Email = "morgan@example.com", Phone = "555-0002" },
                new() { Id = Guid.NewGuid(), Name = "Taylor Smith", Email = "taylor@example.com" }
            });
        }

        await _dbContext.SaveChangesAsync();
    }
}
