using System.Text;
using FutureTech.Api.Infrastructure;
using FutureTech.Application;
using FutureTech.Application.Abstractions;
using FutureTech.Infrastructure;
using FutureTech.Infrastructure.Persistence;
using FutureTech.Infrastructure.Persistence.Seed;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

// The content root defaults to the working directory, which is not necessarily
// where the application was installed: the Windows Service Control Manager
// starts services in C:\Windows\System32, and an operator can launch the
// executable from any folder. Both cases used to start "successfully" and then
// serve an empty platform, because appsettings.json and the SeedData content
// pack were looked for somewhere they do not exist. A published app carries
// them next to its binary, so anchor there when the working directory does not
// have them. `dotnet run` during development is unaffected: the project folder
// holds appsettings.json, so the condition is false.
var options = new WebApplicationOptions
{
    Args = args,
    ContentRootPath = File.Exists(Path.Combine(Directory.GetCurrentDirectory(), "appsettings.json"))
        ? null
        : AppContext.BaseDirectory
};

var builder = WebApplication.CreateBuilder(options);

// Lets the same binary be registered with the Windows Service Control Manager
// (see deploy/windows). It also sets the content root to the binary's folder,
// which is the same anchor chosen above. A no-op when the process is not
// started as a service, so console runs, Docker and Linux are unaffected.
builder.Host.UseWindowsService();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddScoped<IRequestContext, HttpRequestContext>();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment.ContentRootPath);

var signingKey = builder.Configuration["Jwt:SigningKey"]
                 ?? "dev-only-signing-key-change-me-in-production-0123456789";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "futuretech-academy",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "futuretech-academy-web",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization(options =>
    options.AddPolicy("Admin", policy => policy.RequireRole("Admin")));

const string CorsPolicy = "spa";
builder.Services.AddCors(options => options.AddPolicy(CorsPolicy, policy =>
{
    var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
                  ?? ["http://localhost:5173", "http://localhost:4173", "http://localhost:3000"];
    policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
}));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "FutureTech Career Academy API",
        Version = "v1",
        Description = "Career-transition platform for experienced enterprise engineers."
    });

    var scheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the JWT returned by /api/auth/login.",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };
    options.AddSecurityDefinition("Bearer", scheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement { [scheme] = Array.Empty<string>() });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // EnsureCreated keeps first-run friction at zero across both providers.
    // Switch to db.Database.MigrateAsync() once migrations are added.
    await db.Database.EnsureCreatedAsync();
    // EnsureCreated does nothing to a database that already exists, so tables
    // the model has gained since it was created are added here. Additive only.
    await SchemaSync.EnsureTablesAsync(
        db, scope.ServiceProvider.GetRequiredService<ILogger<Program>>());
    await scope.ServiceProvider.GetRequiredService<IDatabaseSeeder>().SeedAsync();
}

app.UseMiddleware<ExceptionMiddleware>();
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "FutureTech API v1");
    options.DocumentTitle = "FutureTech Career Academy API";
});

app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/", () => Results.Redirect("/swagger"));
app.MapGet("/health", () => Results.Ok(new { status = "ok", utc = DateTimeOffset.UtcNow }));

app.Run();
