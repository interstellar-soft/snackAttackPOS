using FluentValidation;
using LitePOS.Api.Models.Inventory;

namespace LitePOS.Api.Validators;

public class InventoryAdjustmentRequestValidator : AbstractValidator<InventoryAdjustmentRequest>
{
    public InventoryAdjustmentRequestValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.QuantityChange).NotEqual(0);
        RuleFor(x => x.Reason).NotEmpty();
    }
}
