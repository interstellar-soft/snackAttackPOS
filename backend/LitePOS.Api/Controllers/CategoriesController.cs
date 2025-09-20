using LitePOS.Api.Data;
using LitePOS.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CategoriesController : ControllerBase
{
    private readonly LitePosDbContext _dbContext;

    public CategoriesController(LitePosDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetCategories([FromQuery] string? search = null)
    {
        var query = _dbContext.Categories.AsNoTracking().Include(c => c.Products).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(c => c.Name.Contains(search));
        }

        var categories = await query.OrderBy(c => c.Name)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Description,
                c.IsActive,
                ProductCount = c.Products.Count
            }).ToListAsync();

        return Ok(categories);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetCategory(Guid id)
    {
        var category = await _dbContext.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        if (category == null)
        {
            return NotFound();
        }

        return Ok(category);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> CreateCategory([FromBody] Category category)
    {
        category.Id = Guid.NewGuid();
        _dbContext.Categories.Add(category);
        await _dbContext.SaveChangesAsync();
        return CreatedAtAction(nameof(GetCategory), new { id = category.Id }, category);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> UpdateCategory(Guid id, [FromBody] Category category)
    {
        var existing = await _dbContext.Categories.FirstOrDefaultAsync(c => c.Id == id);
        if (existing == null)
        {
            return NotFound();
        }

        existing.Name = category.Name;
        existing.Description = category.Description;
        existing.IsActive = category.IsActive;
        await _dbContext.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteCategory(Guid id)
    {
        var category = await _dbContext.Categories.FirstOrDefaultAsync(c => c.Id == id);
        if (category == null)
        {
            return NotFound();
        }

        _dbContext.Categories.Remove(category);
        await _dbContext.SaveChangesAsync();
        return NoContent();
    }
}
