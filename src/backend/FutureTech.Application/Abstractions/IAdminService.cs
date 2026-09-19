using System.Text.Json;

namespace FutureTech.Application.Abstractions;

public record AdminResourceDto(string Key, string Label, string EntityName, int Count, IReadOnlyList<AdminFieldDto> Fields);

public record AdminFieldDto(string Name, string Type, bool Required, IReadOnlyList<string>? Options);

public record AdminPageDto(string Resource, int Total, int Page, int PageSize, IReadOnlyList<Dictionary<string, object?>> Items);

public record AdminStatsDto(
    int Careers, int Courses, int Modules, int Lessons, int Videos, int VideosWithUrl,
    int PracticeQuestions, int InterviewQuestions, int Projects, int Certifications,
    int CodingExercises, int ArchitectureChallenges, int Skills, int Badges, int Learners);

/// <summary>
/// Schema-driven CRUD over the content tables. One implementation serves every
/// admin resource, so adding a content type to Admin does not require a new
/// controller — only a registry entry.
/// </summary>
public interface IAdminService
{
    Task<IReadOnlyList<AdminResourceDto>> ResourcesAsync(CancellationToken ct = default);
    Task<AdminStatsDto> StatsAsync(CancellationToken ct = default);
    Task<AdminPageDto> ListAsync(string resource, string? search, int page, int pageSize, CancellationToken ct = default);
    Task<Dictionary<string, object?>> GetAsync(string resource, Guid id, CancellationToken ct = default);
    Task<Dictionary<string, object?>> CreateAsync(string resource, JsonElement payload, CancellationToken ct = default);
    Task<Dictionary<string, object?>> UpdateAsync(string resource, Guid id, JsonElement payload, CancellationToken ct = default);
    Task DeleteAsync(string resource, Guid id, CancellationToken ct = default);
}
