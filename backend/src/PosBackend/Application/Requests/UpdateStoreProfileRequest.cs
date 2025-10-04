using System.ComponentModel.DataAnnotations;

namespace PosBackend.Application.Requests;

public class UpdateStoreProfileRequest
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
}
