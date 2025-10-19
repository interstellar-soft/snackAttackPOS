using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Features.Categories;

[ApiController]
[Route("api/categories")]
[Authorize(Roles = "Admin,Manager")]
public class CategoriesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public CategoriesController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<CategoryResponse>>> GetCategories(CancellationToken cancellationToken)
    {
        var categories = await _db.Categories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .ToListAsync(cancellationToken);

        var responses = categories.Select(ToResponse).ToList();
        return Ok(responses);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CategoryResponse>> GetCategoryById(Guid id, CancellationToken cancellationToken)
    {
        var category = await _db.Categories
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (category is null)
        {
            return NotFound();
        }

        return Ok(ToResponse(category));
    }

    [HttpPost]
    public async Task<ActionResult<CategoryResponse>> CreateCategory(
        [FromBody] CreateCategoryRequest request,
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

        if (!errors.ContainsKey(nameof(request.Name)))
        {
            var normalizedLower = request.Name!.ToLower();

            var exists = await _db.Categories
                .AnyAsync(c => c.Name.ToLower() == normalizedLower, cancellationToken);

            if (exists)
            {
                AddError(errors, nameof(request.Name), "A category with this name already exists.");
            }
        }

        if (errors.Count > 0)
        {
            return CreateValidationProblem(errors);
        }

        var category = new Category
        {
            Name = request.Name!
        };

        await _db.Categories.AddAsync(category, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        var response = ToResponse(category);
        return CreatedAtAction(nameof(GetCategoryById), new { id = response.Id }, response);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteCategory(Guid id, CancellationToken cancellationToken)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (category is null)
        {
            return NotFound();
        }

        var hasProducts = await _db.Products.AnyAsync(p => p.CategoryId == id, cancellationToken);
        if (hasProducts)
        {
            return BadRequest(new { message = "Cannot delete a category that still has products." });
        }

        _db.Categories.Remove(category);
        await _db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private ActionResult CreateValidationProblem(IDictionary<string, List<string>> errors)
    {
        ModelState.Clear();
        foreach (var error in errors)
        {
            foreach (var message in error.Value)
            {
                ModelState.AddModelError(error.Key, message);
            }
        }

        return ValidationProblem(ModelState);
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

    private static CategoryResponse ToResponse(Category category)
    {
        return new CategoryResponse
        {
            Id = category.Id,
            Name = category.Name
        };
    }
}
