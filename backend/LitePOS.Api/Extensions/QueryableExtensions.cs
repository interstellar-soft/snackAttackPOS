using LitePOS.Api.Responses;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Extensions;

public static class QueryableExtensions
{
    public static async Task<PagedResponse<T>> ToPagedResponseAsync<T>(this IQueryable<T> query, int page, int pageSize)
    {
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new PagedResponse<T>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalItems = total
        };
    }
}
