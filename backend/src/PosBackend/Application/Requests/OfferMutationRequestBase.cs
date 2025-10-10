using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace PosBackend.Application.Requests;

public abstract class OfferMutationRequestBase
{
    [Required]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    [Required]
    public decimal? Price { get; set; }

    public string? Currency { get; set; }

    public bool IsActive { get; set; } = true;

    [MinLength(1)]
    public List<OfferItemRequest> Items { get; set; } = new();
}

public class OfferItemRequest
{
    [Required]
    public Guid ProductId { get; set; }

    [Range(typeof(decimal), "0.01", "79228162514264337593543950335")]
    public decimal Quantity { get; set; }
}

public sealed class CreateOfferRequest : OfferMutationRequestBase
{
}

public sealed class UpdateOfferRequest : OfferMutationRequestBase
{
}
