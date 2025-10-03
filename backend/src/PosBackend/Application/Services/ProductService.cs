using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Application.Services;

public class ProductService
{
    private readonly ApplicationDbContext _db;

    public ProductService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<ProductServiceResult> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken)
    {
        var (errors, category) = await ValidateAsync(request, null, cancellationToken);
        if (errors.Count > 0)
        {
            return ProductServiceResult.Failure(errors);
        }

        var product = new Product
        {
            Name = request.Name,
            Sku = request.Sku,
            Barcode = request.Barcode,
            Description = NormalizeOptional(request.Description),
            CategoryId = request.CategoryId,
            PriceUsd = request.PriceUsd,
            PriceLbp = request.PriceLbp,
            IsActive = true
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync(cancellationToken);

        product.Category = category;
        return ProductServiceResult.Success(product);
    }

    public async Task<ProductServiceResult> UpdateAsync(Guid id, CreateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await _db.Products.Include(p => p.Category)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null)
        {
            return ProductServiceResult.NotFound();
        }

        var (errors, category) = await ValidateAsync(request, id, cancellationToken);
        if (errors.Count > 0)
        {
            return ProductServiceResult.Failure(errors);
        }

        product.Name = request.Name;
        product.Sku = request.Sku;
        product.Barcode = request.Barcode;
        product.Description = NormalizeOptional(request.Description);
        product.CategoryId = request.CategoryId;
        product.PriceUsd = request.PriceUsd;
        product.PriceLbp = request.PriceLbp;
        product.Category = category;
        product.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        return ProductServiceResult.Success(product);
    }

    public ProductResponse ToResponse(Product product)
    {
        return new ProductResponse
        {
            Id = product.Id,
            Sku = product.Sku,
            Name = product.Name,
            Barcode = product.Barcode,
            PriceUsd = product.PriceUsd,
            PriceLbp = product.PriceLbp,
            Category = product.Category?.Name ?? string.Empty
        };
    }

    private async Task<(Dictionary<string, string[]>, Category?)> ValidateAsync(
        CreateProductRequest request,
        Guid? existingProductId,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            AddError(errors, nameof(request.Name), "Name is required.");
        }
        else
        {
            request.Name = request.Name.Trim();
        }

        if (string.IsNullOrWhiteSpace(request.Sku))
        {
            AddError(errors, nameof(request.Sku), "SKU is required.");
        }
        else
        {
            request.Sku = request.Sku.Trim();
        }

        if (string.IsNullOrWhiteSpace(request.Barcode))
        {
            AddError(errors, nameof(request.Barcode), "Barcode is required.");
        }
        else
        {
            request.Barcode = request.Barcode.Trim();
        }

        if (request.PriceUsd < 0)
        {
            AddError(errors, nameof(request.PriceUsd), "PriceUsd cannot be negative.");
        }

        if (request.PriceLbp < 0)
        {
            AddError(errors, nameof(request.PriceLbp), "PriceLbp cannot be negative.");
        }

        if (request.CategoryId == Guid.Empty)
        {
            AddError(errors, nameof(request.CategoryId), "CategoryId is required.");
        }

        if (!errors.ContainsKey(nameof(request.Sku)))
        {
            var skuExists = await _db.Products
                .AnyAsync(p => p.Sku == request.Sku && (!existingProductId.HasValue || p.Id != existingProductId.Value), cancellationToken);
            if (skuExists)
            {
                AddError(errors, nameof(request.Sku), "SKU must be unique.");
            }
        }

        if (!errors.ContainsKey(nameof(request.Barcode)))
        {
            var barcodeExists = await _db.Products
                .AnyAsync(p => p.Barcode == request.Barcode && (!existingProductId.HasValue || p.Id != existingProductId.Value), cancellationToken);
            if (barcodeExists)
            {
                AddError(errors, nameof(request.Barcode), "Barcode must be unique.");
            }
        }

        Category? category = null;
        if (!errors.ContainsKey(nameof(request.CategoryId)))
        {
            category = await _db.Categories
                .FirstOrDefaultAsync(c => c.Id == request.CategoryId, cancellationToken);
            if (category is null)
            {
                AddError(errors, nameof(request.CategoryId), "Category not found.");
            }
        }

        var materialized = errors.ToDictionary(
            pair => pair.Key,
            pair => pair.Value.ToArray(),
            StringComparer.Ordinal);

        return (materialized, category);
    }

    private static void AddError(Dictionary<string, List<string>> errors, string key, string message)
    {
        if (!errors.TryGetValue(key, out var list))
        {
            list = new List<string>();
            errors[key] = list;
        }

        list.Add(message);
    }

    private static string? NormalizeOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public class ProductServiceResult
{
    public bool Succeeded { get; }
    public bool NotFound { get; }
    public Product? Product { get; }
    public IReadOnlyDictionary<string, string[]> Errors { get; }

    private ProductServiceResult(bool succeeded, bool notFound, Product? product, IReadOnlyDictionary<string, string[]> errors)
    {
        Succeeded = succeeded;
        NotFound = notFound;
        Product = product;
        Errors = errors;
    }

    private static readonly IReadOnlyDictionary<string, string[]> EmptyErrors =
        new ReadOnlyDictionary<string, string[]>(new Dictionary<string, string[]>());

    public static ProductServiceResult Success(Product product) =>
        new(true, false, product, EmptyErrors);

    public static ProductServiceResult Failure(IDictionary<string, string[]> errors) =>
        new(false, false, null, new ReadOnlyDictionary<string, string[]>(new Dictionary<string, string[]>(errors)));

    public static ProductServiceResult NotFound() =>
        new(false, true, null, EmptyErrors);
}
