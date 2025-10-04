using System.ComponentModel.DataAnnotations;

namespace PosBackend.Domain.Entities;

public class StoreProfile : BaseEntity
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
}
