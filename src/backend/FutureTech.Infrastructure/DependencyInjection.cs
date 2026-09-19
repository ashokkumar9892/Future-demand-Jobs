using FutureTech.Application.Abstractions;
using FutureTech.Infrastructure.Admin;
using FutureTech.Infrastructure.Evaluation;
using FutureTech.Infrastructure.Identity;
using FutureTech.Infrastructure.Persistence;
using FutureTech.Infrastructure.Persistence.Seed;
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
                options.UseSqlite(connection);
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

        services.AddSingleton(new SeedOptions
        {
            SeedDataPath = Path.Combine(contentRootPath, configuration["Seed:Path"] ?? "SeedData"),
            CreateDemoUser = !bool.TryParse(configuration["Seed:CreateDemoUser"], out var create) || create
        });
        services.AddScoped<IDatabaseSeeder, DatabaseSeeder>();

        return services;
    }
}
