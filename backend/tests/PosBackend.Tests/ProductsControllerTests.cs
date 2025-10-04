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
        var category = new Category { Name = "Snacks" };
        context.Categories.Add(category);
        context.SaveChanges();

        var controller = CreateController(context);
        var request = new CreateProductRequest
        {
            Name = "Potato Chips",
            Sku = "SNK-001",
            Barcode = "1234567890123",
            Price = 2.5m,
            Currency = "USD",
            CategoryId = category.Id
        };

        var result = await controller.CreateProduct(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(ProductsController.GetProductById), created.ActionName);
        var response = Assert.IsType<ProductResponse>(created.Value);
        Assert.Equal(request.Name, response.Name);
        Assert.Equal(request.Sku, response.Sku);

        var stored = await context.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == response.Id);
        Assert.NotNull(stored);
        Assert.Equal(request.Barcode, stored!.Barcode);
        Assert.Equal(2.5m, stored.PriceUsd);
        Assert.Equal(225000m, stored.PriceLbp);
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
            CategoryId = category.Id
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

        context.Categories.AddRange(originalCategory, newCategory);
        context.Products.Add(product);
        context.SaveChanges();

        var controller = CreateController(context);
        var request = new CreateProductRequest
        {
            Name = "Updated",
            Sku = "SNK-002",
            Barcode = "321321321321",
            Price = 270000m,
            Currency = "LBP",
            CategoryId = newCategory.Id
        };

        var result = await controller.UpdateProduct(product.Id, request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ProductResponse>(ok.Value);
        Assert.Equal(request.Name, response.Name);
        Assert.Equal(newCategory.Name, response.Category);

        var stored = await context.Products.Include(p => p.Category).FirstAsync(p => p.Id == product.Id);
        Assert.Equal(request.Sku, stored.Sku);
        Assert.Equal(newCategory.Id, stored.CategoryId);
        Assert.Equal(3m, stored.PriceUsd);
        Assert.Equal(270000m, stored.PriceLbp);
    }

    [Fact]
    public async Task UpdateProduct_ReturnsNotFound_ForMissingProduct()
    {
        await using var context = CreateContext();
        var category = new Category { Name = "Snacks" };
        context.Categories.Add(category);
        context.SaveChanges();

        var controller = CreateController(context);
        var request = new CreateProductRequest
        {
            Name = "New",
            Sku = "SNK-100",
            Barcode = "000000000000",
            Price = 1m,
            Currency = "USD",
            CategoryId = category.Id
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
        var request = new CreateProductRequest
        {
            Name = "Updated",
            Sku = otherProduct.Sku,
            Barcode = "321321321321",
            Price = 2m,
            Currency = "USD",
            CategoryId = category.Id
        };

        var result = await controller.UpdateProduct(product.Id, request, CancellationToken.None);

        var validation = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, validation.StatusCode);
        var problem = Assert.IsType<ValidationProblemDetails>(validation.Value);
        Assert.Contains(nameof(request.Sku), problem.Errors.Keys);
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
        var productService = new ProductService(context, currencyService);
        var controller = new ProductsController(context, mlClient, watchdog, productService)
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
