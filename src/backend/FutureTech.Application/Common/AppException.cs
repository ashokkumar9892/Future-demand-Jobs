namespace FutureTech.Application.Common;

/// <summary>Domain/use-case failure translated to a clean HTTP status by middleware.</summary>
public class AppException : Exception
{
    public int StatusCode { get; }

    public AppException(string message, int statusCode = 400) : base(message) => StatusCode = statusCode;

    public static AppException NotFound(string what) => new($"{what} was not found.", 404);
    public static AppException Unauthorized(string message = "Not authenticated.") => new(message, 401);
    public static AppException Forbidden(string message = "Not allowed.") => new(message, 403);
    public static AppException Conflict(string message) => new(message, 409);
}
