using System.Text.Json;
using FutureTech.Application.Abstractions;
using FutureTech.Application.Contracts;
using FutureTech.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FutureTech.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController(IDashboardService dashboard) : ControllerBase
{
    /// <summary>Everything the home screen renders, in a single round trip.</summary>
    [HttpGet]
    public Task<DashboardDto> Get(CancellationToken ct) => dashboard.GetAsync(ct);
}

[ApiController]
[Route("api/projects")]
public class ProjectsController(IProjectService projects) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public Task<IReadOnlyList<ProjectListItemDto>> List(CancellationToken ct) => projects.ListAsync(ct);

    [HttpGet("{slug}")]
    [AllowAnonymous]
    public Task<ProjectDetailDto> Get(string slug, CancellationToken ct) => projects.GetAsync(slug, ct);

    [HttpPost("{id:guid}/progress")]
    [Authorize]
    public Task<ProjectDetailDto> Progress(Guid id, ProjectProgressRequest request, CancellationToken ct) =>
        projects.SaveProgressAsync(id, request, ct);

    [HttpPost("{id:guid}/milestones/{milestoneId:guid}/toggle")]
    [Authorize]
    public Task<ProjectDetailDto> ToggleMilestone(Guid id, Guid milestoneId, CancellationToken ct) =>
        projects.ToggleMilestoneAsync(id, milestoneId, ct);
}

[ApiController]
[Route("api/certifications")]
public class CertificationsController(ICertificationService certifications) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public Task<IReadOnlyList<CertificationDto>> List(CancellationToken ct) => certifications.ListAsync(ct);

    [HttpPut("mine/{id:guid}")]
    [Authorize]
    public Task<CertificationDto> UpdateMine(Guid id, UserCertificationUpdateRequest request, CancellationToken ct) =>
        certifications.UpdateMineAsync(id, request, ct);
}

[ApiController]
[Route("api/skills")]
[Authorize]
public class SkillsController(ISkillService skills) : ControllerBase
{
    [HttpGet("matrix")]
    public Task<SkillMatrixDto> Matrix([FromQuery] Guid? careerPathId, CancellationToken ct) =>
        skills.GetMatrixAsync(careerPathId, ct);

    [HttpPut("mine")]
    public Task<SkillMatrixDto> Update(SkillLevelUpdateRequest request, CancellationToken ct) =>
        skills.UpdateLevelAsync(request, ct);
}

[ApiController]
[Route("api/readiness")]
[Authorize]
public class ReadinessController(IReadinessService readiness) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<CareerReadinessDto>> List(CancellationToken ct) => readiness.ListAsync(ct);

    [HttpGet("{careerSlug}")]
    public Task<CareerReadinessDto> Get(string careerSlug, CancellationToken ct) => readiness.GetAsync(careerSlug, ct);
}

[ApiController]
[Route("api/resume")]
[Authorize]
public class ResumeController(IResumeService resume) : ControllerBase
{
    [HttpGet]
    public Task<ResumeDto> Get(CancellationToken ct) => resume.GetAsync(ct);

    [HttpPost("generate")]
    public Task<ResumeDto> Generate(CancellationToken ct) => resume.GenerateAsync(ct);
}

[ApiController]
[Route("api/notes")]
[Authorize]
public class NotesController(INoteService notes) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<NoteDto>> List(
        [FromQuery] string? scope, [FromQuery] Guid? refId, [FromQuery] string? search,
        [FromQuery] bool importantOnly = false, CancellationToken ct = default) =>
        notes.ListAsync(scope, refId, search, importantOnly, ct);

    [HttpPost]
    public Task<NoteDto> Create(NoteUpsertRequest request, CancellationToken ct) => notes.CreateAsync(request, ct);

    [HttpPut("{id:guid}")]
    public Task<NoteDto> Update(Guid id, NoteUpsertRequest request, CancellationToken ct) =>
        notes.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await notes.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/bookmarks")]
[Authorize]
public class BookmarksController(IBookmarkService bookmarks) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<BookmarkDto>> List([FromQuery] string? itemType, CancellationToken ct) =>
        bookmarks.ListAsync(itemType, ct);

    /// <summary>Adds the bookmark, or removes it when it is already saved.</summary>
    [HttpPost("toggle")]
    public Task<BookmarkDto> Toggle(BookmarkRequest request, CancellationToken ct) =>
        bookmarks.ToggleAsync(request, ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await bookmarks.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/search")]
public class SearchController(ISearchService search) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public Task<SearchResponseDto> Search([FromQuery] string q, [FromQuery] int limit = 8, CancellationToken ct = default) =>
        search.SearchAsync(q, limit, ct);
}

[ApiController]
[Route("api/gamification")]
[Authorize]
public class GamificationController(IGamificationService gamification) : ControllerBase
{
    [HttpGet]
    public Task<GamificationDto> Get(CancellationToken ct) => gamification.GetAsync(ct);
}

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "Admin")]
public class AdminController(IAdminService admin, ICareerService careers) : ControllerBase
{
    [HttpGet("resources")]
    public Task<IReadOnlyList<AdminResourceDto>> Resources(CancellationToken ct) => admin.ResourcesAsync(ct);

    [HttpGet("stats")]
    public Task<AdminStatsDto> Stats(CancellationToken ct) => admin.StatsAsync(ct);

    [HttpGet("{resource}")]
    public Task<AdminPageDto> List(
        string resource, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) =>
        admin.ListAsync(resource, search, page, pageSize, ct);

    [HttpGet("{resource}/{id:guid}")]
    public Task<Dictionary<string, object?>> Get(string resource, Guid id, CancellationToken ct) =>
        admin.GetAsync(resource, id, ct);

    [HttpPost("{resource}")]
    public Task<Dictionary<string, object?>> Create(string resource, [FromBody] JsonElement payload, CancellationToken ct) =>
        admin.CreateAsync(resource, payload, ct);

    [HttpPut("{resource}/{id:guid}")]
    public Task<Dictionary<string, object?>> Update(
        string resource, Guid id, [FromBody] JsonElement payload, CancellationToken ct) =>
        admin.UpdateAsync(resource, id, payload, ct);

    [HttpDelete("{resource}/{id:guid}")]
    public async Task<IActionResult> Delete(string resource, Guid id, CancellationToken ct)
    {
        await admin.DeleteAsync(resource, id, ct);
        return NoContent();
    }

    /// <summary>Dedicated salary endpoint so every change writes a SalaryRevisions audit row.</summary>
    [HttpPut("careers/{id:guid}/salary")]
    public Task<CareerSummaryDto> UpdateSalary(Guid id, SalaryUpdateRequest request, CancellationToken ct) =>
        careers.UpdateSalaryAsync(id, request, ct);
}
