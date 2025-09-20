using FluentValidation;
using LitePOS.Api.Models.Settings;

namespace LitePOS.Api.Validators;

public class UpdateStoreSettingRequestValidator : AbstractValidator<UpdateStoreSettingRequest>
{
    public UpdateStoreSettingRequestValidator()
    {
        RuleFor(x => x.StoreName).NotEmpty();
        RuleFor(x => x.Currency).NotEmpty();
        RuleFor(x => x.DefaultTaxRate).GreaterThanOrEqualTo(0);
    }
}
