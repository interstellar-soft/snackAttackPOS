using LitePOS.Api.Data;
using LitePOS.Api.Entities;
using LitePOS.Api.Models.Customers;
using LitePOS.Api.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CustomersController : ControllerBase
{
    private readonly LitePosDbContext _dbContext;

    public CustomersController(LitePosDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResponse<CustomerDto>>> GetCustomers([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? search = null)
    {
        var query = _dbContext.Customers.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(c => c.Name.Contains(search) || (c.Email != null && c.Email.Contains(search)) || (c.Phone != null && c.Phone.Contains(search)));
        }

        var total = await query.CountAsync();
        var customers = await query.OrderBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResponse<CustomerDto>
        {
            Items = customers.Select(MapCustomer).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalItems = total
        };
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CustomerDto>> GetCustomer(Guid id)
    {
        var customer = await _dbContext.Customers.FindAsync(id);
        if (customer == null)
        {
            return NotFound();
        }

        return MapCustomer(customer);
    }

    [HttpPost]
    public async Task<ActionResult<CustomerDto>> CreateCustomer([FromBody] UpsertCustomerRequest request)
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Email = request.Email,
            Phone = request.Phone,
            Notes = request.Notes
        };
        _dbContext.Customers.Add(customer);
        await _dbContext.SaveChangesAsync();
        return CreatedAtAction(nameof(GetCustomer), new { id = customer.Id }, MapCustomer(customer));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<CustomerDto>> UpdateCustomer(Guid id, [FromBody] UpsertCustomerRequest request)
    {
        var customer = await _dbContext.Customers.FirstOrDefaultAsync(c => c.Id == id);
        if (customer == null)
        {
            return NotFound();
        }

        customer.Name = request.Name;
        customer.Email = request.Email;
        customer.Phone = request.Phone;
        customer.Notes = request.Notes;
        await _dbContext.SaveChangesAsync();
        return MapCustomer(customer);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> DeleteCustomer(Guid id)
    {
        var customer = await _dbContext.Customers.FirstOrDefaultAsync(c => c.Id == id);
        if (customer == null)
        {
            return NotFound();
        }

        _dbContext.Customers.Remove(customer);
        await _dbContext.SaveChangesAsync();
        return NoContent();
    }

    private static CustomerDto MapCustomer(Customer customer) => new()
    {
        Id = customer.Id,
        Name = customer.Name,
        Email = customer.Email,
        Phone = customer.Phone,
        Notes = customer.Notes
    };
}
