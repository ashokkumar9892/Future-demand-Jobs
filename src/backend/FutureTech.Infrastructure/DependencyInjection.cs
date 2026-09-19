using FutureTech.Application.Abstractions;
using FutureTech.Infrastructure.Admin;
using FutureTech.Infrastructure.Evaluation;
using FutureTech.Infrastructure.Identity;
using FutureTech.Infrastructure.Persistence;
using FutureTech.Infrastructure.Persistence.Seed;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FutureTech.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration, string contentRootPath)
    {
        var provider = configuration["Database:Provider"] ?? "Sqlite";

        services.AddDbContext<AppDbContext>(options =>
        {
            if (provider.Equals("Postgres", StringComparison.OrdinalIgnoreCase))
            {
                options.UseNpgsql(
                    configuration.GetConnectionString("Postgres")
                    ?? "Host=localhost;Port=5432;Database=futuretech;Username=postgres;Password=postgres");
            }
            else
            {
                // SQLite keeps `dotnet run` working on a machine with no database
                // server installed. The EF model is identical on both providers.
                var connection = configuration.GetConnectionString("Sqlite")
                                 ?? $"Data Source={Path.Combine(contentRootPath, "futuretech.db")}";
                options.UseSqlite(ResolveSqlitePath(connection, contentRootPath));
            }
        });

        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        var jwt = new JwtOptions
        {
            Issuer = configuration["Jwt:Issuer"] ?? "futuretech-academy",
            Audience = configuration["Jwt:Audience"] ?? "futuretech-academy-web",
            SigningKey = configuration["Jwt:SigningKey"]
                         ?? "dev-only-signing-key-change-me-in-production-0123456789",
            ExpiryHours = int.TryParse(configuration["Jwt:ExpiryHours"], out var hours) ? hours : 12
        };
        services.AddSingleton(jwt);
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();
        services.AddSingleton<IAnswerEvaluator, RubricAnswerEvaluator>();

        services.AddScoped<IAdminService, AdminService>();

        // Sign-in auditing. Location lookup is off the request path: the audit
        // writes whatever is cached and queues anything unseen for the worker.
        var geo = new GeoIpOptions
        {
            Enabled = !bool.TryParse(configuration["GeoIp:Enabled"], out var geoEnabled) || geoEnabled,
            Endpoint = configuration["GeoIp:Endpoint"] is { Length: > 0 } endpoint
                ? endpoint
                : new GeoIpOptions().Endpoint,
            Source = configuration["GeoIp:Source"] ?? "ip-api.com",
            TimeoutSeconds = int.TryParse(configuration["GeoIp:TimeoutSeconds"], out var timeout) ? timeout : 5,
            CacheDays = int.TryParse(configuration["GeoIp:CacheDays"], out var cacheDays) ? cacheDays : 30,
            MinIntervalMilliseconds =
                int.TryParse(configuration["GeoIp:MinIntervalMilliseconds"], out var interval) ? interval : 1500
        };
        services.AddSingleton(geo);
        services.AddSingleton<GeoLookupQueue>();
        services.AddScoped<ILoginAuditService, LoginAuditService>();
        services.AddHttpClient<IGeoIpResolver, HttpGeoIpResolver>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(geo.TimeoutSeconds);
            // Free geo endpoints reject or throttle requests with no agent.
            client.DefaultRequestHeaders.UserAgent.ParseAdd("FutureTechAcademy/1.0");
        });
        services.AddHostedService<GeoLookupWorker>();

        services.AddSingleton(new SeedOptions
        {
            SeedDataPath = Path.Combine(contentRootPath, configuration["Seed:Path"] ?? "SeedData"),
            CreateDemoUser = !bool.TryParse(configuration["Seed:CreateDemoUser"], out var create) || create
        });
        services.AddScoped<IDatabaseSeeder, DatabaseSeeder>();

        return services;
    }

    /// <summary>
    /// Rebases a relative SQLite <c>Data Source</c> onto the content root, and
    /// creates the folder it names.
    /// </summary>
    /// <remarks>
    /// SQLite resolves a relative path against the process working directory,
    /// which is not where the application lives. A Windows service is started
    /// by the SCM with the working directory set to <c>C:\Windows\System32</c>,
    /// and a console run inherits whatever directory the operator happened to
    /// be in — so "Data Source=data/futuretech.db" would point somewhere
    /// different in each case, and usually somewhere that does not exist.
    /// Anchoring it to the content root makes the database travel with the
    /// installation regardless of how the process was started.
    /// </remarks>
    private static string ResolveSqlitePath(string connectionString, string contentRootPath)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString);
        var source = builder.DataSource;

        // ":memory:" and shared-cache URIs are not file paths; leave them alone.
        if (string.IsNullOrWhiteSpace(source) ||
            source.StartsWith(":memory:", StringComparison.OrdinalIgnoreCase) ||
            source.StartsWith("file:", StringComparison.OrdinalIgnoreCase))
        {
            return connectionString;
        }

        if (!Path.IsPathRooted(source))
        {
            builder.DataSource = Path.GetFullPath(Path.Combine(contentRootPath, source));
        }

        var directory = Path.GetDirectoryName(builder.DataSource);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        return builder.ToString();
    }
}
