using FutureTech.Application.Contracts;
using FutureTech.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FutureTech.Api.Controllers;

/// <summary>Learner-facing feedback. Signing in is required so a reply has somewhere to go.</summary>
[ApiController]
[Route("api/feedback")]
[Authorize]
public class FeedbackController(IFeedbackService feedback) : ControllerBase
{
    [HttpPost]
    public Task<FeedbackDto> Submit(FeedbackSubmitRequest request, CancellationToken ct) =>
        feedback.SubmitAsync(request, ct);

    /// <summary>The learner's own items, including whatever the admin replied.</summary>
    [HttpGet("mine")]
    public Task<IReadOnlyList<FeedbackDto>> Mine(CancellationToken ct) => feedback.MineAsync(ct);
}

/// <summary>The feedback queue an admin triages and implements from.</summary>
[ApiController]
[Route("api/admin/feedback")]
[Authorize(Policy = "Admin")]
public class AdminFeedbackController(IFeedbackService feedback) : ControllerBase
{
    /// <summary><paramref name="status"/> accepts a status name, "open" (the default) or "all".</summary>
    [HttpGet]
    public Task<PagedDto<AdminFeedbackDto>> List(
        [FromQuery] string? status,
        [FromQuery] string? category,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        feedback.ListAsync(status, category, search, page, pageSize, ct);

    [HttpGet("summary")]
    public Task<FeedbackSummaryDto> Summary(CancellationToken ct) => feedback.SummaryAsync(ct);

    /// <summary>Reply, move the status, or record what was implemented. Any subset.</summary>
    [HttpPut("{id:guid}")]
    public Task<AdminFeedbackDto> Update(Guid id, FeedbackUpdateRequest request, CancellationToken ct) =>
        feedback.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await feedback.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>
/// Who has an account, what they are studying, and where they signed in from.
/// Read-only: nothing here changes learner data.
/// </summary>
[ApiController]
[Route("api/admin/engagement")]
[Authorize(Policy = "Admin")]
public class AdminEngagementController(IEngagementService engagement) : ControllerBase
{
    [HttpGet("overview")]
    public Task<EngagementOverviewDto> Overview(CancellationToken ct) => engagement.OverviewAsync(ct);

    /// <summary><paramref name="sort"/> is "recent" (default), "name" or "joined".</summary>
    [HttpGet("learners")]
    public Task<PagedDto<LearnerRowDto>> Learners(
        [FromQuery] string? search,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        engagement.LearnersAsync(search, sort, page, pageSize, ct);

    /// <summary>Course-by-course progress, login history and feedback for one account.</summary>
    [HttpGet("learners/{id:guid}")]
    public Task<LearnerDetailDto> Learner(Guid id, CancellationToken ct) => engagement.LearnerAsync(id, ct);

    /// <summary><paramref name="outcome"/> is a LoginOutcome name, "failed" or "all".</summary>
    [HttpGet("logins")]
    public Task<PagedDto<LoginEventDto>> Logins(
        [FromQuery] string? search,
        [FromQuery] string? outcome,
        [FromQuery] Guid? userId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default) =>
        engagement.LoginsAsync(search, outcome, userId, page, pageSize, ct);

    [HttpGet("courses")]
    public Task<IReadOnlyList<CourseEngagementDto>> Courses(CancellationToken ct) => engagement.CoursesAsync(ct);
}
