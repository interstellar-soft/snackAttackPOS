using System.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace LitePOS.Api.Middleware;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;

    public ErrorHandlingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task Invoke(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (DbUpdateException ex)
        {
            Log.Error(ex, "Database update error");
            await WriteProblemDetails(context, HttpStatusCode.BadRequest, "A database error occurred.");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Unhandled exception");
            await WriteProblemDetails(context, HttpStatusCode.InternalServerError, "An unexpected error occurred.");
        }
    }

    private static async Task WriteProblemDetails(HttpContext context, HttpStatusCode statusCode, string detail)
    {
        var problem = new ProblemDetails
        {
            Status = (int)statusCode,
            Detail = detail,
            Instance = context.Request.Path
        };

        context.Response.ContentType = "application/problem+json";
        context.Response.StatusCode = problem.Status ?? (int)statusCode;
        await context.Response.WriteAsJsonAsync(problem);
    }
}
