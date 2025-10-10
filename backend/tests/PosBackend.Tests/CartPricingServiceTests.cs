using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Services;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;
using Xunit;

namespace PosBackend.Tests;

public class CartPricingServiceTests
{
    [Fact]
    public async Task PriceCartAsync_AppliesSingleProductOffer()
    {
        using var db = CreateContext();

        var (product, offer) = await SeedSingleProductOfferAsync(db);
        var service = CreateService(db);

        var items = new List<CartItemRequest>
        {
            new(product.Id, 10m, null, null)
        };

        var (totalUsd, _, lines) = await service.PriceCartAsync(items, 90000m);

        Assert.Equal(10m, totalUsd);
        var line = Assert.Single(lines);
        Assert.Equal(10m, line.TotalUsd);
        Assert.Equal(10m, line.Quantity);
        Assert.Equal(product.Id, line.ProductId);
        Assert.Equal(offer.Id, line.OfferId);
    }

    [Fact]
    public async Task PriceCartAsync_AppliesOfferWhenItemsAreSeparateEntries()
    {
        using var db = CreateContext();

        var (product, offer) = await SeedSingleProductOfferAsync(db);
        var service = CreateService(db);

        var items = Enumerable.Repeat(new CartItemRequest(product.Id, 1m, null, null), 10).ToList();

        var (totalUsd, _, lines) = await service.PriceCartAsync(items, 90000m);

        Assert.Equal(10m, totalUsd);
        var line = Assert.Single(lines);
        Assert.Equal(10m, line.TotalUsd);
        Assert.Equal(10m, line.Quantity);
        Assert.Equal(product.Id, line.ProductId);
        Assert.Equal(offer.Id, line.OfferId);
    }

    [Fact]
    public async Task PriceCartAsync_AllowsOfferWhenPriceRuleIdIsEmpty()
    {
        using var db = CreateContext();

        var (product, offer) = await SeedSingleProductOfferAsync(db);
        var service = CreateService(db);

        var items = new List<CartItemRequest>
        {
            new(product.Id, 10m, Guid.Empty, null)
        };

        var (totalUsd, _, lines) = await service.PriceCartAsync(items, 90000m);

        Assert.Equal(10m, totalUsd);
        var line = Assert.Single(lines);
        Assert.Equal(offer.Id, line.OfferId);
    }

    private static CartPricingService CreateService(ApplicationDbContext db)
    {
        var currencyService = new CurrencyService(db);
        return new CartPricingService(db, currencyService);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static async Task<(Product product, Offer offer)> SeedSingleProductOfferAsync(ApplicationDbContext db)
    {
        var category = new Category
        {
            Id = Guid.NewGuid(),
            Name = "Cigarettes"
        };

        var product = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Category = category,
            Name = "Marlboro",
            Barcode = "123",
            PriceUsd = 1.10m,
            PriceLbp = 99000m
        };

        var offer = new Offer
        {
            Id = Guid.NewGuid(),
            Name = "10 Marlboro for $10",
            PriceUsd = 10m,
            PriceLbp = 900000m,
            IsActive = true
        };

        var offerItem = new OfferItem
        {
            Id = Guid.NewGuid(),
            OfferId = offer.Id,
            Offer = offer,
            ProductId = product.Id,
            Product = product,
            Quantity = 10m
        };

        offer.Items.Add(offerItem);

        db.Categories.Add(category);
        db.Products.Add(product);
        db.Offers.Add(offer);
        db.OfferItems.Add(offerItem);

        await db.SaveChangesAsync();

        return (product, offer);
    }
}
