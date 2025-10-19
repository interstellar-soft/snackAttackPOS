using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Domain.Entities;
using PosBackend.Features.Products;
using PosBackend.Infrastructure.Data;
using Xunit;

namespace PosBackend.Tests;

public class ProductsControllerTests
{
    [Fact]
    public async Task CreateProduct_PersistsProduct()
    {
        await using var context = CreateContext();

        var controller = CreateController(context);
        var request = new CreateProductRequest
        {
            Name = "Potato Chips",
            Sku = "SNK-001",
            Barcode = "1234567890123",
            Price = 2.5m,
            Currency = "USD",
            CategoryName = "Snacks",
            ReorderPoint = 7m
        };

        var result = await controller.CreateProduct(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(ProductsController.GetProductById), created.ActionName);
        var response = Assert.IsType<ProductResponse>(created.Value);
        Assert.Equal(request.Name, response.Name);
        Assert.Equal(request.Sku, response.Sku);
        Assert.Equal(request.CategoryName, response.CategoryName);
        Assert.Equal(7m, response.ReorderPoint);

        var stored = await context.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == response.Id);
        Assert.NotNull(stored);
        Assert.Equal(request.Barcode, stored!.Barcode);
        Assert.Equal(2.5m, stored.PriceUsd);
        Assert.Equal(225000m, stored.PriceLbp);

        var storedInventory = await context.Inventories.AsNoTracking().FirstOrDefaultAsync(i => i.ProductId == response.Id);
        Assert.NotNull(storedInventory);
        Assert.Equal(7m, storedInventory!.ReorderPoint);
        Assert.True(storedInventory.IsReorderAlarmEnabled);

        var category = await context.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.Id == stored.CategoryId);
        Assert.NotNull(category);
        Assert.Equal(request.CategoryName, category!.Name);
    }

    [Fact]
    public async Task CreateProduct_AllowsMissingSku()
    {
        await using var context = CreateContext();

        var controller = CreateController(context);
        var request = new CreateProductRequest
        {
            Name = "Mystery Snack",
            Sku = null,
            Barcode = "5555555555555",
            Price = 1.25m,
            Currency = "USD",
            CategoryName = "Snacks"
        };

        var result = await controller.CreateProduct(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var response = Assert.IsType<ProductResponse>(created.Value);
        Assert.Equal(request.Name, response.Name);
        Assert.Null(response.Sku);

        var stored = await context.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == response.Id);
        Assert.NotNull(stored);
        Assert.Null(stored!.Sku);
    }

    [Fact]
    public async Task CreateProduct_ReturnsValidationProblem_ForDuplicateSku()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Pantry" };
        var existing = new Product
        {
            Category = category,
            Name = "Existing",
            Sku = "SNK-001",
            Barcode = "000111222333",
            PriceUsd = 1m,
            PriceLbp = 90000m
        };

        context.Categories.Add(category);
        context.Products.Add(existing);
        context.SaveChanges();

        var controller = CreateController(context);
        var request = new CreateProductRequest
        {
            Name = "Duplicate",
            Sku = "SNK-001",
            Barcode = "999888777666",
            Price = 2m,
            Currency = "USD",
            CategoryName = category.Name
        };

        var result = await controller.CreateProduct(request, CancellationToken.None);

        var validation = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, validation.StatusCode);
        var problem = Assert.IsType<ValidationProblemDetails>(validation.Value);
        Assert.Contains(nameof(request.Sku), problem.Errors.Keys);
    }

    [Fact]
    public async Task UpdateProduct_UpdatesExistingEntity()
    {
        await using var context = CreateContext();
        var originalCategory = new Category { Name = "Pantry" };
        var newCategory = new Category { Name = "Beverages" };
        var product = new Product
        {
            Category = originalCategory,
            Name = "Original",
            Sku = "SNK-001",
            Barcode = "123123123123",
            PriceUsd = 1m,
            PriceLbp = 90000m
        };

        var inventory = new Inventory
        {
            Product = product,
            QuantityOnHand = 5m,
            AverageCostUsd = 1m,
            AverageCostLbp = 90000m,
            ReorderPoint = 3m,
            ReorderQuantity = 0m,
            IsReorderAlarmEnabled = true
        };

        context.Categories.AddRange(originalCategory, newCategory);
        context.Products.Add(product);
        context.Inventories.Add(inventory);
        context.SaveChanges();

        var controller = CreateController(context);
        var request = new UpdateProductRequest
        {
            Name = "Updated",
            Sku = "SNK-002",
            Barcode = "321321321321",
            Price = 270000m,
            Currency = "LBP",
            CategoryName = newCategory.Name,
            ReorderPoint = 9m
        };

        var result = await controller.UpdateProduct(product.Id, request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ProductResponse>(ok.Value);
        Assert.Equal(request.Name, response.Name);
        Assert.Equal(newCategory.Name, response.CategoryName);
        Assert.Equal(9m, response.ReorderPoint);

        var stored = await context.Products.Include(p => p.Category).FirstAsync(p => p.Id == product.Id);
        Assert.Equal(request.Sku, stored.Sku);
        Assert.Equal(newCategory.Id, stored.CategoryId);
        Assert.Equal(3m, stored.PriceUsd);
        Assert.Equal(270000m, stored.PriceLbp);

        var updatedInventory = await context.Inventories.AsNoTracking().FirstAsync(i => i.ProductId == product.Id);
        Assert.Equal(9m, updatedInventory.ReorderPoint);
    }

    [Fact]
    public async Task UpdateProduct_AllowsClearingSku()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Snacks" };
        var product = new Product
        {
            Category = category,
            Name = "Original",
            Sku = "SNK-001",
            Barcode = "123123123123",
            PriceUsd = 1m,
            PriceLbp = 90000m
        };

        context.Categories.Add(category);
        context.Products.Add(product);
        context.SaveChanges();

        var controller = CreateController(context);
        var request = new UpdateProductRequest
        {
            Name = "Original",
            Sku = "   ",
            Barcode = "123123123123",
            Price = 1m,
            Currency = "USD",
            CategoryName = category.Name
        };

        var result = await controller.UpdateProduct(product.Id, request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ProductResponse>(ok.Value);
        Assert.Null(response.Sku);

        var stored = await context.Products.AsNoTracking().FirstAsync(p => p.Id == product.Id);
        Assert.Null(stored.Sku);
    }

    [Fact]
    public async Task UpdateProduct_AddsAdditionalBarcodes()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Snacks" };
        var product = new Product
        {
            Category = category,
            Name = "Crunchy Chips",
            Barcode = "1234567890123",
            PriceUsd = 2m,
            PriceLbp = 180000m
        };

        context.Categories.Add(category);
        context.Products.Add(product);
        await context.SaveChangesAsync();

        var controller = CreateController(context);
        var request = new UpdateProductRequest
        {
            Name = product.Name,
            Barcode = product.Barcode,
            Price = product.PriceUsd,
            Currency = "USD",
            CategoryName = category.Name,
            ReorderPoint = 5m,
            AdditionalBarcodes = new List<ProductBarcodeInput>
            {
                new()
                {
                    Code = "9876543210987",
                    Quantity = 1
                }
            }
        };

        var result = await controller.UpdateProduct(product.Id, request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ProductResponse>(ok.Value);
        var responseBarcodes = Assert.NotNull(response.AdditionalBarcodes);
        var additional = Assert.Single(responseBarcodes);
        Assert.Equal("9876543210987", additional.Code);
        Assert.Equal(1, additional.QuantityPerScan);

        var stored = await context.ProductBarcodes
            .Where(b => b.ProductId == product.Id)
            .ToListAsync();

        Assert.Single(stored);
        Assert.Equal("9876543210987", stored[0].Code);
    }

    [Fact]
    public async Task UpdateProduct_AllowsUpdatingInventoryAndBarcodesTogether()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Personal Care" };
        var product = new Product
        {
            Category = category,
            Name = "Test Product",
            Barcode = "5280350016332",
            PriceUsd = 2.5m,
            PriceLbp = 225000m,
            Inventory = new Inventory
            {
                QuantityOnHand = 1m,
                ReorderPoint = 2m,
                AverageCostUsd = 1.5m,
                AverageCostLbp = 135000m,
                IsReorderAlarmEnabled = true
            }
        };

        var rate = new CurrencyRate
        {
            BaseCurrency = "USD",
            QuoteCurrency = "LBP",
            Rate = 90000m
        };

        context.Categories.Add(category);
        context.CurrencyRates.Add(rate);
        context.Products.Add(product);
        context.SaveChanges();

        var controller = CreateController(context);
        var request = new UpdateProductRequest
        {
            Name = "Test Product",
            Barcode = "5280350016332",
            Price = 2.5m,
            Currency = "USD",
            CategoryName = category.Name,
            ReorderPoint = 3m,
            QuantityOnHand = 2m,
            Cost = 1.95m,
            CostCurrency = "USD",
            AdditionalBarcodes = new List<ProductBarcodeInput>
            {
                new()
                {
                    Code = "5280350016333",
                    Quantity = 1,
                    Price = 2.5m,
                    Currency = "USD"
                }
            }
        };

        var result = await controller.UpdateProduct(product.Id, request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ProductResponse>(ok.Value);
        Assert.Equal(2m, response.QuantityOnHand);
        var additional = Assert.Single(response.AdditionalBarcodes);
        Assert.Equal("5280350016333", additional.Code);

        var storedInventory = await context.Inventories.AsNoTracking().FirstAsync(i => i.ProductId == product.Id);
        Assert.Equal(2m, storedInventory.QuantityOnHand);
        Assert.Equal(3m, storedInventory.ReorderPoint);
    }

    [Fact]
    public async Task UpdateProduct_ReturnsValidationProblem_ForDuplicateAdditionalBarcodesIgnoringCase()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Snacks" };
        var product = new Product
        {
            Category = category,
            Name = "Crunchy Chips",
            Barcode = "1234567890123",
            PriceUsd = 2m,
            PriceLbp = 180000m
        };

        context.Categories.Add(category);
        context.Products.Add(product);
        await context.SaveChangesAsync();

        var controller = CreateController(context);
        var request = new UpdateProductRequest
        {
            Name = product.Name,
            Barcode = product.Barcode,
            Price = product.PriceUsd,
            Currency = "USD",
            CategoryName = category.Name,
            AdditionalBarcodes = new List<ProductBarcodeInput>
            {
                new()
                {
                    Code = "ABC123",
                    Quantity = 1
                },
                new()
                {
                    Code = "abc123",
                    Quantity = 1
                }
            }
        };

        var result = await controller.UpdateProduct(product.Id, request, CancellationToken.None);

        var validation = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, validation.StatusCode);
        var problem = Assert.IsType<ValidationProblemDetails>(validation.Value);
        Assert.Contains(nameof(request.AdditionalBarcodes), problem.Errors.Keys);
    }

    [Fact]
    public async Task UpdateProduct_ReturnsValidationProblem_WhenAdditionalBarcodeConflictsIgnoringCase()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Snacks" };
        var product = new Product
        {
            Category = category,
            Name = "Crunchy Chips",
            Barcode = "1234567890123",
            PriceUsd = 2m,
            PriceLbp = 180000m
        };

        var otherProduct = new Product
        {
            Category = category,
            Name = "Existing",
            Barcode = "9876543210987",
            PriceUsd = 3m,
            PriceLbp = 270000m
        };

        otherProduct.AdditionalBarcodes.Add(new ProductBarcode
        {
            Code = "XYZ789",
            QuantityPerScan = 1
        });

        context.Categories.Add(category);
        context.Products.AddRange(product, otherProduct);
        await context.SaveChangesAsync();

        var controller = CreateController(context);
        var request = new UpdateProductRequest
        {
            Name = product.Name,
            Barcode = product.Barcode,
            Price = product.PriceUsd,
            Currency = "USD",
            CategoryName = category.Name,
            AdditionalBarcodes = new List<ProductBarcodeInput>
            {
                new()
                {
                    Code = "xyz789",
                    Quantity = 1
                }
            }
        };

        var result = await controller.UpdateProduct(product.Id, request, CancellationToken.None);

        var validation = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, validation.StatusCode);
        var problem = Assert.IsType<ValidationProblemDetails>(validation.Value);
        Assert.Contains(nameof(request.AdditionalBarcodes), problem.Errors.Keys);
    }

    [Fact]
    public async Task UpdateProduct_ReturnsNotFound_ForMissingProduct()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Snacks" };
        context.Categories.Add(category);
        context.SaveChanges();

        var controller = CreateController(context);
        var request = new UpdateProductRequest
        {
            Name = "New",
            Sku = "SNK-100",
            Barcode = "000000000000",
            Price = 1m,
            Currency = "USD",
            CategoryName = category.Name
        };

        var result = await controller.UpdateProduct(Guid.NewGuid(), request, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task UpdateProduct_ReturnsValidationProblem_ForDuplicateSku()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Pantry" };
        var otherProduct = new Product
        {
            Category = category,
            Name = "Other",
            Sku = "SNK-002",
            Barcode = "222111333444",
            PriceUsd = 2m,
            PriceLbp = 180000m
        };

        var product = new Product
        {
            Category = category,
            Name = "Original",
            Sku = "SNK-001",
            Barcode = "111222333444",
            PriceUsd = 1m,
            PriceLbp = 90000m
        };

        context.Categories.Add(category);
        context.Products.AddRange(product, otherProduct);
        context.SaveChanges();

        var controller = CreateController(context);
        var request = new UpdateProductRequest
        {
            Name = "Updated",
            Sku = otherProduct.Sku,
            Barcode = "321321321321",
            Price = 2m,
            Currency = "USD",
            CategoryName = category.Name
        };

        var result = await controller.UpdateProduct(product.Id, request, CancellationToken.None);

        var validation = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, validation.StatusCode);
        var problem = Assert.IsType<ValidationProblemDetails>(validation.Value);
        Assert.Contains(nameof(request.Sku), problem.Errors.Keys);
    }

    [Fact]
    public async Task UpdateProduct_ReturnsValidationProblem_WhenBarcodeMatchesAdditionalBarcode()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Snacks" };
        var product = new Product
        {
            Category = category,
            Name = "Target",
            Barcode = "555000111222",
            PriceUsd = 2m,
            PriceLbp = 180000m
        };

        var otherProduct = new Product
        {
            Category = category,
            Name = "Existing",
            Barcode = "999888777666",
            PriceUsd = 3m,
            PriceLbp = 270000m
        };

        otherProduct.AdditionalBarcodes.Add(new ProductBarcode
        {
            Code = "321321321321",
            QuantityPerScan = 1
        });

        context.Categories.Add(category);
        context.Products.AddRange(product, otherProduct);
        context.SaveChanges();

        var controller = CreateController(context);
        var request = new UpdateProductRequest
        {
            Name = product.Name,
            Barcode = "321321321321",
            Price = product.PriceUsd,
            Currency = "USD",
            CategoryName = category.Name
        };

        var result = await controller.UpdateProduct(product.Id, request, CancellationToken.None);

        var validation = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, validation.StatusCode);
        var problem = Assert.IsType<ValidationProblemDetails>(validation.Value);
        Assert.Contains(nameof(request.Barcode), problem.Errors.Keys);
    }

    [Fact]
    public async Task GetProducts_ReturnsAllProducts()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Snacks" };
        var products = new[]
        {
            new Product
            {
                Category = category,
                Name = "A",
                Sku = "A-1",
                Barcode = "100",
                PriceUsd = 1m,
                PriceLbp = 90000m
            },
            new Product
            {
                Category = category,
                Name = "B",
                Sku = "B-1",
                Barcode = "200",
                PriceUsd = 2m,
                PriceLbp = 180000m
            }
        };

        context.Categories.Add(category);
        context.Products.AddRange(products);
        context.SaveChanges();

        var controller = CreateController(context);

        var result = await controller.GetProducts(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsAssignableFrom<IEnumerable<ProductResponse>>(ok.Value);
        Assert.Equal(2, response.Count());
    }

    [Fact]
    public async Task Search_ReturnsProducts_WhenSkuMissing()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Snacks" };
        var product = new Product
        {
            Category = category,
            Name = "Mystery Snack",
            Sku = null,
            Barcode = "555", 
            PriceUsd = 1m,
            PriceLbp = 90000m
        };

        context.Categories.Add(category);
        context.Products.Add(product);
        context.SaveChanges();

        var controller = CreateController(context);

        var result = await controller.Search("mystery", null, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var responses = Assert.IsAssignableFrom<IEnumerable<ProductResponse>>(ok.Value);
        var single = Assert.Single(responses);
        Assert.Equal(product.Name, single.Name);
        Assert.Null(single.Sku);
    }

    [Fact]
    public async Task GetProductById_ReturnsProduct()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Snacks" };
        var product = new Product
        {
            Category = category,
            Name = "Existing",
            Sku = "SNK-001",
            Barcode = "000111222333",
            PriceUsd = 1m,
            PriceLbp = 90000m
        };

        context.Categories.Add(category);
        context.Products.Add(product);
        context.SaveChanges();

        var controller = CreateController(context);

        var result = await controller.GetProductById(product.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ProductResponse>(ok.Value);
        Assert.Equal(product.Name, response.Name);
        Assert.Equal(product.Sku, response.Sku);
    }

    [Fact]
    public async Task GetProductById_ReturnsNotFound_ForMissingProduct()
    {
        await using var context = CreateContext();
        var controller = CreateController(context);

        var result = await controller.GetProductById(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task DeleteProduct_RemovesEntity()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Snacks" };
        var product = new Product
        {
            Category = category,
            Name = "To Delete",
            Sku = "DEL-001",
            Barcode = "555444333222",
            PriceUsd = 1m,
            PriceLbp = 90000m
        };

        context.Categories.Add(category);
        context.Products.Add(product);
        context.SaveChanges();

        var controller = CreateController(context);

        var result = await controller.DeleteProduct(product.Id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.False(await context.Products.AnyAsync(p => p.Id == product.Id));
    }

    [Fact]
    public async Task DeleteProduct_ReturnsNotFound_ForMissingProduct()
    {
        await using var context = CreateContext();
        var controller = CreateController(context);

        var result = await controller.DeleteProduct(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Scan_ReturnsProduct_WhenSkuMissing()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Snacks" };
        var product = new Product
        {
            Category = category,
            Name = "Mystery",
            Sku = null,
            Barcode = "999888777666",
            PriceUsd = 2m,
            PriceLbp = 180000m
        };

        context.Categories.Add(category);
        context.Products.Add(product);
        context.SaveChanges();

        var controller = CreateController(context);

        var result = await controller.Scan(new ScanRequest { Barcode = product.Barcode }, CancellationToken.None);

        var response = Assert.IsType<ProductResponse>(result.Value);
        Assert.Equal(product.Name, response.Name);
        Assert.Null(response.Sku);
        Assert.False(response.IsFlagged ?? false);
    }

    private static ProductsController CreateController(ApplicationDbContext context)
    {
        var settings = new Dictionary<string, string?>
        {
            ["MlService:BaseUrl"] = "http://localhost"
        };

        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var httpClient = new HttpClient(new FakeHttpMessageHandler());
        var mlClient = new MlClient(httpClient, configuration);
        var watchdog = new ScanWatchdog();
        var currencyService = new CurrencyService(context);
        var controller = new ProductsController(context, mlClient, watchdog, currencyService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        return controller;
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var context = new ApplicationDbContext(options);
        context.Database.EnsureCreated();
        context.CurrencyRates.Add(new CurrencyRate
        {
            BaseCurrency = "USD",
            QuoteCurrency = "LBP",
            Rate = 90000m
        });
        context.SaveChanges();
        return context;
    }

    private sealed class FakeHttpMessageHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}")
            };

            return Task.FromResult(response);
        }
    }
}
