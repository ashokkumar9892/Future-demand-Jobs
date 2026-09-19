using System.Security.Claims;
using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Domain.Common;

namespace FutureTech.Api.Infrastructure;

public class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public Guid? UserId =>
        Guid.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public string? Email => Principal?.FindFirstValue(ClaimTypes.Email);

    public UserRole Role =>
        Enum.TryParse<UserRole>(Principal?.FindFirstValue(ClaimTypes.Role), out var role) ? role : UserRole.Learner;

    public bool IsAuthenticated => UserId is not null;

    public Guid RequireUserId() => UserId ?? throw AppException.Unauthorized();
}
