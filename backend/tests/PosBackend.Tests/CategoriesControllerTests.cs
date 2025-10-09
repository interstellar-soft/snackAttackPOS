using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Domain.Entities;
using PosBackend.Features.Categories;
using PosBackend.Infrastructure.Data;
using Xunit;

namespace PosBackend.Tests;

public class CategoriesControllerTests
{
    [Fact]
    public async Task CreateCategory_PersistsCategory()
    {
        await using var context = CreateContext();
        var controller = CreateController(context);
        var request = new CreateCategoryRequest
        {
            Name = "  Snacks  "
        };

        var result = await controller.CreateCategory(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(CategoriesController.GetCategoryById), created.ActionName);
        var response = Assert.IsType<CategoryResponse>(created.Value);
        Assert.Equal("Snacks", response.Name);

        var stored = await context.Categories.AsNoTracking().SingleAsync();
        Assert.Equal(response.Id, stored.Id);
        Assert.Equal("Snacks", stored.Name);
    }

    [Fact]
    public async Task CreateCategory_ReturnsValidationProblem_ForDuplicateName()
    {
        await using var context = CreateContext();
        context.Categories.Add(new Category { Name = "Snacks" });
        context.SaveChanges();

        var controller = CreateController(context);
        var request = new CreateCategoryRequest
        {
            Name = "snacks"
        };

        var result = await controller.CreateCategory(request, CancellationToken.None);

        var validation = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, validation.StatusCode);
        var problem = Assert.IsType<ValidationProblemDetails>(validation.Value);
        Assert.Contains(nameof(request.Name), problem.Errors.Keys);
    }

    [Fact]
    public async Task GetCategories_ReturnsAllCategories()
    {
        await using var context = CreateContext();
        context.Categories.AddRange(
            new Category { Name = "Beverages" },
            new Category { Name = "Snacks" },
            new Category { Name = "Fruits" });
        context.SaveChanges();

        var controller = CreateController(context);

        var result = await controller.GetCategories(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var categories = Assert.IsAssignableFrom<IEnumerable<CategoryResponse>>(ok.Value);
        var list = categories.ToList();
        Assert.Equal(3, list.Count);
        Assert.True(list.SequenceEqual(list.OrderBy(c => c.Name)));
    }

    private static CategoriesController CreateController(ApplicationDbContext context)
    {
        return new CategoriesController(context)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var context = new ApplicationDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }
}
