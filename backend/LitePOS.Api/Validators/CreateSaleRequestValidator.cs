using FluentValidation;
using LitePOS.Api.Models.Sales;

namespace LitePOS.Api.Validators;

public class CreateSaleRequestValidator : AbstractValidator<CreateSaleRequest>
{
    public CreateSaleRequestValidator()
    {
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).SetValidator(new CreateSaleItemRequestValidator());
        RuleFor(x => x.CashPayment).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CardPayment).GreaterThanOrEqualTo(0);
    }
}

public class CreateSaleItemRequestValidator : AbstractValidator<CreateSaleItemRequest>
{
    public CreateSaleItemRequestValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.DiscountPercent).InclusiveBetween(0, 100);
    }
}
