namespace FutureTech.Application.Common;

/// <summary>
/// Enough of the user-agent string to answer "which browser, which device".
/// Deliberately small: a full UA database is a dependency this platform does
/// not need, and the admin console only shows a label.
/// </summary>
public static class UserAgentParser
{
    public record Result(string Browser, string OperatingSystem, string DeviceKind);

    public static Result Parse(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent)) return new Result("Unknown", "Unknown", "Unknown");
        var ua = userAgent;

        var browser =
            Has(ua, "Edg/") || Has(ua, "Edge/") ? "Edge"
            : Has(ua, "OPR/") || Has(ua, "Opera") ? "Opera"
            : Has(ua, "SamsungBrowser") ? "Samsung Internet"
            : Has(ua, "Firefox") ? "Firefox"
            // Chrome's UA contains "Safari", so Chrome has to be tested first.
            : Has(ua, "Chrome") || Has(ua, "CriOS") ? "Chrome"
            : Has(ua, "Safari") ? "Safari"
            : Has(ua, "curl") || Has(ua, "PostmanRuntime") || Has(ua, "HttpClient") ? "API client"
            : "Unknown";

        var os =
            Has(ua, "Windows NT 10") ? "Windows"
            : Has(ua, "Windows") ? "Windows"
            : Has(ua, "Android") ? "Android"
            : Has(ua, "iPhone") || Has(ua, "iPad") || Has(ua, "iOS") ? "iOS"
            : Has(ua, "Mac OS X") || Has(ua, "Macintosh") ? "macOS"
            : Has(ua, "CrOS") ? "ChromeOS"
            : Has(ua, "Linux") ? "Linux"
            : "Unknown";

        var device =
            Has(ua, "bot") || Has(ua, "crawler") || Has(ua, "spider") ? "Bot"
            : Has(ua, "iPad") || (Has(ua, "Android") && !Has(ua, "Mobile")) ? "Tablet"
            : Has(ua, "Mobi") || Has(ua, "iPhone") || Has(ua, "Android") ? "Mobile"
            : os == "Unknown" && browser == "Unknown" ? "Unknown"
            : "Desktop";

        return new Result(browser, os, device);
    }

    private static bool Has(string haystack, string needle) =>
        haystack.Contains(needle, StringComparison.OrdinalIgnoreCase);
}
