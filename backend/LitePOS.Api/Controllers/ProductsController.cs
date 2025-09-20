using LitePOS.Api.Data;
using LitePOS.Api.Entities;
using LitePOS.Api.Models.Products;
using LitePOS.Api.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly LitePosDbContext _dbContext;

    public ProductsController(LitePosDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResponse<ProductDto>>> GetProducts([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? search = null, [FromQuery] Guid? categoryId = null, [FromQuery] bool? isActive = null)
    {
        var query = _dbContext.Products.AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .Include(p => p.Modifiers)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(p => p.Name.Contains(search) || p.Sku.Contains(search) || (p.Barcode != null && p.Barcode.Contains(search)));
        }

        if (categoryId.HasValue)
        {
            query = query.Where(p => p.CategoryId == categoryId);
        }

        if (isActive.HasValue)
        {
            query = query.Where(p => p.IsActive == isActive);
        }

        var total = await query.CountAsync();
        var products = await query
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dto = products.Select(MapProduct);

        return new PagedResponse<ProductDto>
        {
            Items = dto.ToList(),
            Page = page,
            PageSize = pageSize,
            TotalItems = total
        };
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProductDto>> GetProduct(Guid id)
    {
        var product = await _dbContext.Products
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .Include(p => p.Modifiers)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (product == null)
        {
            return NotFound();
        }

        return MapProduct(product);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<ProductDto>> CreateProduct([FromBody] CreateProductRequest request)
    {
        var now = DateTime.UtcNow;
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Sku = request.Sku,
            Barcode = request.Barcode,
            Description = request.Description,
            Price = request.Price,
            Cost = request.Cost,
            TaxClass = request.TaxClass,
            IsActive = request.IsActive,
            CategoryId = request.CategoryId,
            StockQuantity = request.StockQuantity,
            LowStockThreshold = request.LowStockThreshold,
            TaxRate = request.TaxRate,
            ImageUrl = request.ImageUrl,
            CreatedAt = now,
            UpdatedAt = now,
            Variants = request.Variants.Select(v => new ProductVariant
            {
                Id = v.Id ?? Guid.NewGuid(),
                Name = v.Name,
                Sku = v.Sku,
                Barcode = v.Barcode,
                Price = v.Price
            }).ToList(),
            Modifiers = request.Modifiers.Select(m => new ProductModifier
            {
                Id = m.Id ?? Guid.NewGuid(),
                Name = m.Name,
                PriceDelta = m.PriceDelta
            }).ToList()
        };

        _dbContext.Products.Add(product);
        await _dbContext.SaveChangesAsync();

        product = await _dbContext.Products
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .Include(p => p.Modifiers)
            .FirstAsync(p => p.Id == product.Id);

        return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, MapProduct(product));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<ProductDto>> UpdateProduct(Guid id, [FromBody] UpdateProductRequest request)
    {
        var product = await _dbContext.Products
            .Include(p => p.Variants)
            .Include(p => p.Modifiers)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (product == null)
        {
            return NotFound();
        }

        product.Name = request.Name;
        product.Sku = request.Sku;
        product.Barcode = request.Barcode;
        product.Description = request.Description;
        product.Price = request.Price;
        product.Cost = request.Cost;
        product.TaxClass = request.TaxClass;
        product.IsActive = request.IsActive;
        product.CategoryId = request.CategoryId;
        product.StockQuantity = request.StockQuantity;
        product.LowStockThreshold = request.LowStockThreshold;
        product.TaxRate = request.TaxRate;
        product.ImageUrl = request.ImageUrl;
        product.UpdatedAt = DateTime.UtcNow;

        UpdateVariants(product, request.Variants);
        UpdateModifiers(product, request.Modifiers);

        await _dbContext.SaveChangesAsync();

        await _dbContext.Entry(product).Reference(p => p.Category).LoadAsync();
        await _dbContext.Entry(product).Collection(p => p.Variants).LoadAsync();
        await _dbContext.Entry(product).Collection(p => p.Modifiers).LoadAsync();

        return MapProduct(product);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ArchiveProduct(Guid id)
    {
        var product = await _dbContext.Products.FirstOrDefaultAsync(p => p.Id == id);
        if (product == null)
        {
            return NotFound();
        }

        product.IsActive = false;
        product.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();
        return NoContent();
    }

    private static void UpdateVariants(Product product, List<ProductVariantRequest> variants)
    {
        var existing = product.Variants.ToDictionary(v => v.Id, v => v);
        var requestedIds = variants.Where(v => v.Id.HasValue).Select(v => v.Id!.Value).ToHashSet();

        foreach (var variant in product.Variants.Where(v => !requestedIds.Contains(v.Id)).ToList())
        {
            product.Variants.Remove(variant);
        }

        foreach (var variantRequest in variants)
        {
            if (variantRequest.Id.HasValue && existing.TryGetValue(variantRequest.Id.Value, out var variant))
            {
                variant.Name = variantRequest.Name;
                variant.Sku = variantRequest.Sku;
                variant.Barcode = variantRequest.Barcode;
                variant.Price = variantRequest.Price;
            }
            else
            {
                product.Variants.Add(new ProductVariant
                {
                    Id = variantRequest.Id ?? Guid.NewGuid(),
                    Name = variantRequest.Name,
                    Sku = variantRequest.Sku,
                    Barcode = variantRequest.Barcode,
                    Price = variantRequest.Price
                });
            }
        }
    }

    private static void UpdateModifiers(Product product, List<ProductModifierRequest> modifiers)
    {
        var existing = product.Modifiers.ToDictionary(m => m.Id, m => m);
        var requestedIds = modifiers.Where(m => m.Id.HasValue).Select(m => m.Id!.Value).ToHashSet();

        foreach (var modifier in product.Modifiers.Where(m => !requestedIds.Contains(m.Id)).ToList())
        {
            product.Modifiers.Remove(modifier);
        }

        foreach (var modifierRequest in modifiers)
        {
            if (modifierRequest.Id.HasValue && existing.TryGetValue(modifierRequest.Id.Value, out var modifier))
            {
                modifier.Name = modifierRequest.Name;
                modifier.PriceDelta = modifierRequest.PriceDelta;
            }
            else
            {
                product.Modifiers.Add(new ProductModifier
                {
                    Id = modifierRequest.Id ?? Guid.NewGuid(),
                    Name = modifierRequest.Name,
                    PriceDelta = modifierRequest.PriceDelta
                });
            }
        }
    }

    private static ProductDto MapProduct(Product product)
    {
        return new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Sku = product.Sku,
            Barcode = product.Barcode,
            Description = product.Description,
            Price = product.Price,
            Cost = product.Cost,
            TaxClass = product.TaxClass,
            IsActive = product.IsActive,
            CategoryId = product.CategoryId,
            CategoryName = product.Category?.Name ?? string.Empty,
            StockQuantity = product.StockQuantity,
            LowStockThreshold = product.LowStockThreshold,
            TaxRate = product.TaxRate,
            ImageUrl = product.ImageUrl,
            Variants = product.Variants.Select(v => new ProductVariantDto
            {
                Id = v.Id,
                Name = v.Name,
                Sku = v.Sku,
                Barcode = v.Barcode,
                Price = v.Price
            }).ToList(),
            Modifiers = product.Modifiers.Select(m => new ProductModifierDto
            {
                Id = m.Id,
                Name = m.Name,
                PriceDelta = m.PriceDelta
            }).ToList()
        };
    }
}
