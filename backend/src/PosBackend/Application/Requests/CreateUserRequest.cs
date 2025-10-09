namespace PosBackend.Application.Requests;

public class CreateUserRequest
{
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? DisplayName { get; set; }
    public string? Role { get; set; }
}
