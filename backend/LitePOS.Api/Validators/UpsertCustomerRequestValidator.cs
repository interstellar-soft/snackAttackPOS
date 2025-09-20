using FluentValidation;
using LitePOS.Api.Models.Customers;

namespace LitePOS.Api.Validators;

public class UpsertCustomerRequestValidator : AbstractValidator<UpsertCustomerRequest>
{
    public UpsertCustomerRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(160);
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Phone).MaximumLength(80).When(x => !string.IsNullOrWhiteSpace(x.Phone));
    }
}
