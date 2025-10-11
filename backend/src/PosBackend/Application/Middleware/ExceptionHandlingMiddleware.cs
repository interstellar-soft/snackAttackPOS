using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PosBackend.Application.Exceptions;

namespace PosBackend.Application.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            if (context.Response.HasStarted)
            {
                _logger.LogError(ex, "Unhandled exception occurred after the response started for {Method} {Path}", context.Request.Method, context.Request.Path);
                throw;
            }

            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, title, detail) = MapException(exception);

        _logger.LogError(exception, "Unhandled exception while processing {Method} {Path}", context.Request.Method, context.Request.Path);

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail,
            Instance = context.Request.Path
        };

        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(problemDetails);
    }

    private static (int StatusCode, string Title, string? Detail) MapException(Exception exception)
    {
        return exception switch
        {
            MlClientException mlClientException => ((int)HttpStatusCode.BadGateway, "ML service error", mlClientException.Message),
            DbUpdateConcurrencyException => ((int)HttpStatusCode.Conflict, "A concurrency conflict occurred while saving changes.", null),
            DbUpdateException => ((int)HttpStatusCode.BadRequest, "A database error occurred while saving changes.", null),
            BadHttpRequestException badRequestException => (StatusCodes.Status400BadRequest, "The request was invalid.", badRequestException.Message),
            _ => ((int)HttpStatusCode.InternalServerError, "An unexpected error occurred.", null)
        };
    }
}
