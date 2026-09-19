using System.Collections;
using System.Reflection;
using System.Text.Json;
using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using FutureTech.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Infrastructure.Admin;

/// <summary>
/// One schema-driven CRUD implementation for every admin-managed content table.
/// The alternative — a hand-written controller and DTO per resource — would be
/// roughly fifteen near-identical files to maintain as content types are added.
/// Content tables are small (hundreds of rows), so search is applied in memory.
/// </summary>
public class AdminService(AppDbContext db) : IAdminService
{
    private static readonly MethodInfo SetMethod = typeof(DbContext)
        .GetMethods()
        .First(m => m is { Name: "Set", IsGenericMethod: true } && m.GetParameters().Length == 0);

    private static readonly Dictionary<string, (string Label, Type Type)> Resources = new(StringComparer.OrdinalIgnoreCase)
    {
        ["careers"] = ("Career paths", typeof(CareerPath)),
        ["career-skills"] = ("Career skills", typeof(CareerSkill)),
        ["ladder-stages"] = ("Career ladder stages", typeof(LadderStage)),
        ["readiness-dimensions"] = ("Job readiness weights", typeof(ReadinessDimension)),
        ["career-prerequisites"] = ("Career certifications", typeof(CareerCertification)),
        ["courses"] = ("Courses", typeof(Course)),
        ["modules"] = ("Modules", typeof(FutureTech.Domain.Entities.Module)),
        ["lessons"] = ("Lessons", typeof(Lesson)),
        ["videos"] = ("Videos", typeof(Video)),
        ["quiz-questions"] = ("Quiz questions", typeof(QuizQuestion)),
        ["practice-questions"] = ("Practice questions", typeof(PracticeQuestion)),
        ["interview-questions"] = ("Interview questions", typeof(InterviewQuestion)),
        ["architecture-challenges"] = ("Architecture challenges", typeof(ArchitectureChallenge)),
        ["coding-exercises"] = ("Coding exercises", typeof(CodingExercise)),
        ["projects"] = ("Projects", typeof(Project)),
        ["project-milestones"] = ("Project milestones", typeof(ProjectMilestone)),
        ["certifications"] = ("Certifications", typeof(Certification)),
        ["countries"] = ("Markets & currencies", typeof(Country)),
        ["course-prices"] = ("Course prices by country", typeof(CoursePrice)),
        ["payment-methods"] = ("Payment methods", typeof(PaymentMethodOption)),
        ["salary-bands"] = ("Career salary by country", typeof(CareerSalaryBand)),
        ["skills"] = ("Technologies & skills", typeof(Skill)),
        ["badges"] = ("Badges", typeof(Badge))
    };

    public async Task<IReadOnlyList<AdminResourceDto>> ResourcesAsync(CancellationToken ct = default)
    {
        var result = new List<AdminResourceDto>();
        foreach (var (key, (label, type)) in Resources)
        {
            var count = await Query(type).CountAsync(ct);
            result.Add(new AdminResourceDto(key, label, type.Name, count, DescribeFields(type)));
        }
        return result.OrderBy(r => r.Label).ToList();
    }

    public async Task<AdminStatsDto> StatsAsync(CancellationToken ct = default) => new(
        await db.CareerPaths.CountAsync(ct),
        await db.Courses.CountAsync(ct),
        await db.Modules.CountAsync(ct),
        await db.Lessons.CountAsync(ct),
        await db.Videos.CountAsync(ct),
        await db.Videos.CountAsync(v => v.YouTubeUrl != null && v.YouTubeUrl != "", ct),
        await db.PracticeQuestions.CountAsync(ct),
        await db.InterviewQuestions.CountAsync(ct),
        await db.Projects.CountAsync(ct),
        await db.Certifications.CountAsync(ct),
        await db.CodingExercises.CountAsync(ct),
        await db.ArchitectureChallenges.CountAsync(ct),
        await db.Skills.CountAsync(ct),
        await db.Badges.CountAsync(ct),
        await db.Users.CountAsync(ct));

    public async Task<AdminPageDto> ListAsync(string resource, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        var type = Resolve(resource);
        var rows = await Query(type).ToListAsync(ct);
        var mapped = rows.Select(r => ToDictionary(r, type)).ToList();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            mapped = mapped.Where(row => row.Values.Any(v =>
                v is string s && s.Contains(term, StringComparison.OrdinalIgnoreCase))).ToList();
        }

        var safePage = Math.Max(1, page);
        var safeSize = Math.Clamp(pageSize <= 0 ? 25 : pageSize, 1, 200);

        return new AdminPageDto(
            resource, mapped.Count, safePage, safeSize,
            mapped.Skip((safePage - 1) * safeSize).Take(safeSize).ToList());
    }

    public async Task<Dictionary<string, object?>> GetAsync(string resource, Guid id, CancellationToken ct = default)
    {
        var type = Resolve(resource);
        var entity = await FindAsync(type, id, ct) ?? throw AppException.NotFound(resource);
        return ToDictionary(entity, type);
    }

    public async Task<Dictionary<string, object?>> CreateAsync(string resource, JsonElement payload, CancellationToken ct = default)
    {
        var type = Resolve(resource);
        if (Activator.CreateInstance(type) is not Entity entity)
            throw new AppException($"Cannot create a {resource}.");

        ApplyPayload(entity, type, payload);
        entity.Id = entity.Id == Guid.Empty ? Guid.NewGuid() : entity.Id;
        entity.CreatedAt = DateTimeOffset.UtcNow;

        db.Add(entity);
        await db.SaveChangesAsync(ct);
        return ToDictionary(entity, type);
    }

    public async Task<Dictionary<string, object?>> UpdateAsync(string resource, Guid id, JsonElement payload, CancellationToken ct = default)
    {
        var type = Resolve(resource);
        var entity = await FindAsync(type, id, ct) ?? throw AppException.NotFound(resource);

        ApplyPayload(entity, type, payload);
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return ToDictionary(entity, type);
    }

    public async Task DeleteAsync(string resource, Guid id, CancellationToken ct = default)
    {
        var type = Resolve(resource);
        var entity = await FindAsync(type, id, ct) ?? throw AppException.NotFound(resource);
        db.Remove(entity);
        await db.SaveChangesAsync(ct);
    }

    // ----- reflection plumbing -------------------------------------------

    private static Type Resolve(string resource) =>
        Resources.TryGetValue(resource, out var entry)
            ? entry.Type
            : throw AppException.NotFound($"Admin resource '{resource}'");

    private IQueryable<Entity> Query(Type type) =>
        (IQueryable<Entity>)SetMethod.MakeGenericMethod(type).Invoke(db, null)!;

    private async Task<Entity?> FindAsync(Type type, Guid id, CancellationToken ct) =>
        await Query(type).FirstOrDefaultAsync(e => e.Id == id, ct);

    private static bool IsScalar(PropertyInfo p)
    {
        if (!p.CanRead || p.GetIndexParameters().Length > 0) return false;
        var type = Nullable.GetUnderlyingType(p.PropertyType) ?? p.PropertyType;
        if (type == typeof(string)) return true;
        if (typeof(IEnumerable).IsAssignableFrom(type)) return false;
        return type.IsPrimitive || type.IsEnum || type == typeof(Guid) ||
               type == typeof(decimal) || type == typeof(DateTimeOffset) ||
               type == typeof(DateTime) || type == typeof(DateOnly);
    }

    private static Dictionary<string, object?> ToDictionary(object entity, Type type)
    {
        var result = new Dictionary<string, object?>();
        foreach (var property in type.GetProperties(BindingFlags.Public | BindingFlags.Instance).Where(IsScalar))
        {
            var value = property.GetValue(entity);
            result[Camel(property.Name)] = value switch
            {
                Enum e => e.ToString(),
                DateOnly d => d.ToString("yyyy-MM-dd"),
                DateTimeOffset dto => dto.ToString("O"),
                _ => value
            };
        }
        return result;
    }

    private static IReadOnlyList<AdminFieldDto> DescribeFields(Type type)
    {
        var fields = new List<AdminFieldDto>();
        foreach (var property in type.GetProperties(BindingFlags.Public | BindingFlags.Instance).Where(IsScalar))
        {
            if (property.Name is nameof(Entity.CreatedAt) or nameof(Entity.UpdatedAt)) continue;

            var underlying = Nullable.GetUnderlyingType(property.PropertyType) ?? property.PropertyType;
            var kind = underlying switch
            {
                _ when underlying.IsEnum => "enum",
                _ when underlying == typeof(bool) => "boolean",
                _ when underlying == typeof(int) || underlying == typeof(double) => "number",
                _ when underlying == typeof(Guid) => "guid",
                _ when underlying == typeof(DateOnly) => "date",
                _ => "string"
            };

            fields.Add(new AdminFieldDto(
                Camel(property.Name),
                kind,
                property.Name == nameof(Entity.Id) ? false : !IsNullable(property),
                underlying.IsEnum ? Enum.GetNames(underlying) : null));
        }
        return fields;
    }

    private static bool IsNullable(PropertyInfo property) =>
        Nullable.GetUnderlyingType(property.PropertyType) is not null ||
        new NullabilityInfoContext().Create(property).WriteState == NullabilityState.Nullable;

    /// <summary>Copies only the properties present in the payload, so PATCH-style updates are safe.</summary>
    private static void ApplyPayload(object entity, Type type, JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object) throw new AppException("Expected a JSON object.");

        var properties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => IsScalar(p) && p.CanWrite)
            .ToDictionary(p => Camel(p.Name), p => p, StringComparer.OrdinalIgnoreCase);

        foreach (var field in payload.EnumerateObject())
        {
            if (!properties.TryGetValue(field.Name, out var property)) continue;
            if (property.Name is nameof(Entity.Id) or nameof(Entity.CreatedAt)) continue;

            var target = Nullable.GetUnderlyingType(property.PropertyType) ?? property.PropertyType;

            if (field.Value.ValueKind == JsonValueKind.Null)
            {
                if (Nullable.GetUnderlyingType(property.PropertyType) is not null || !property.PropertyType.IsValueType)
                    property.SetValue(entity, null);
                continue;
            }

            try
            {
                object? converted = target switch
                {
                    _ when target.IsEnum => Enum.Parse(target, field.Value.GetString() ?? string.Empty, true),
                    _ when target == typeof(DateOnly) => DateOnly.Parse(field.Value.GetString() ?? string.Empty),
                    _ when target == typeof(Guid) => Guid.Parse(field.Value.GetString() ?? string.Empty),
                    _ when target == typeof(string) => field.Value.GetString(),
                    _ when target == typeof(bool) => field.Value.GetBoolean(),
                    _ when target == typeof(int) => field.Value.GetInt32(),
                    _ when target == typeof(double) => field.Value.GetDouble(),
                    _ => JsonSerializer.Deserialize(field.Value.GetRawText(), target, Text.Json)
                };
                property.SetValue(entity, converted);
            }
            catch (Exception ex) when (ex is FormatException or ArgumentException or InvalidOperationException or JsonException)
            {
                throw new AppException($"Field '{field.Name}' has an invalid value for type {target.Name}.");
            }
        }
    }

    private static string Camel(string name) =>
        name.Length == 0 ? name : char.ToLowerInvariant(name[0]) + name[1..];
}
