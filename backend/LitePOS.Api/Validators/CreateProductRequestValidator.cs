using FluentValidation;
using LitePOS.Api.Models.Products;

namespace LitePOS.Api.Validators;

public class CreateProductRequestValidator : AbstractValidator<CreateProductRequest>
{
    public CreateProductRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(160);
        RuleFor(x => x.Sku).NotEmpty().MaximumLength(64);
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Cost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleForEach(x => x.Variants).SetValidator(new ProductVariantRequestValidator());
        RuleForEach(x => x.Modifiers).SetValidator(new ProductModifierRequestValidator());
    }
}

public class ProductVariantRequestValidator : AbstractValidator<ProductVariantRequest>
{
    public ProductVariantRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0);
    }
}

public class ProductModifierRequestValidator : AbstractValidator<ProductModifierRequest>
{
    public ProductModifierRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
    }
}
