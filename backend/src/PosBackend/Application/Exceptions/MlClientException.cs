using System.Net;

namespace PosBackend.Application.Exceptions;

public class MlClientException : Exception
{
    public MlClientException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }

    public MlClientException(string message, HttpStatusCode statusCode, string? responseBody, Exception? innerException = null)
        : base(message, innerException)
    {
        StatusCode = statusCode;
        ResponseBody = responseBody;
    }

    public HttpStatusCode? StatusCode { get; }

    public string? ResponseBody { get; }
}
