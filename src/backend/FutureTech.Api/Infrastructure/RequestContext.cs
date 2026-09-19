using FutureTech.Application.Abstractions;

namespace FutureTech.Api.Infrastructure;

/// <summary>
/// Reads the caller's address and user-agent off the current request.
/// <para>
/// Behind nginx, Netlify or any other reverse proxy the socket address is the
/// proxy, so the forwarded header is preferred when the deployment says it can
/// be trusted. It is opt-in: honouring <c>X-Forwarded-For</c> unconditionally
/// would let any client claim whatever address it liked in the audit trail.
/// </para>
/// </summary>
public class HttpRequestContext(IHttpContextAccessor accessor, IConfiguration configuration) : IRequestContext
{
    private readonly bool trustForwardedHeaders =
        bool.TryParse(configuration["Network:TrustForwardedHeaders"], out var trust) && trust;

    public string IpAddress
    {
        get
        {
            var context = accessor.HttpContext;
            if (context is null) return string.Empty;

            if (trustForwardedHeaders)
            {
                // The left-most entry is the original client; the rest are proxies.
                var forwarded = context.Request.Headers["X-Forwarded-For"].ToString();
                if (!string.IsNullOrWhiteSpace(forwarded))
                {
                    var first = forwarded.Split(',')[0].Trim();
                    if (first.Length > 0) return first;
                }

                var realIp = context.Request.Headers["X-Real-IP"].ToString();
                if (!string.IsNullOrWhiteSpace(realIp)) return realIp.Trim();
            }

            return context.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
        }
    }

    public string UserAgent =>
        accessor.HttpContext?.Request.Headers.UserAgent.ToString() ?? string.Empty;
}
