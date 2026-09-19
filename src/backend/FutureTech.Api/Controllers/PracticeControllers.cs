using FutureTech.Application.Contracts;
using FutureTech.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FutureTech.Api.Controllers;

[ApiController]
[Route("api/practice")]
public class PracticeController(IPracticeService practice) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public Task<IReadOnlyList<PracticeListItemDto>> List(
        [FromQuery] string? mode, [FromQuery] string? category,
        [FromQuery] Guid? careerPathId, [FromQuery] string? search, CancellationToken ct) =>
        practice.ListAsync(mode, category, careerPathId, search, ct);

    [HttpGet("categories")]
    [AllowAnonymous]
    public Task<IReadOnlyList<string>> Categories(CancellationToken ct) => practice.CategoriesAsync(ct);

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public Task<PracticeDetailDto> Get(Guid id, CancellationToken ct) => practice.GetAsync(id, ct);

    [HttpPost("{id:guid}/attempt")]
    [Authorize]
    public Task<PracticeResultDto> Attempt(Guid id, PracticeAttemptRequest request, CancellationToken ct) =>
        practice.AttemptAsync(id, request, ct);
}

[ApiController]
[Route("api/architecture-challenges")]
public class ArchitectureLabController(IArchitectureLabService lab) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public Task<IReadOnlyList<ArchitectureChallengeListItemDto>> List(CancellationToken ct) => lab.ListAsync(ct);

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public Task<ArchitectureChallengeDetailDto> Get(Guid id, CancellationToken ct) => lab.GetAsync(id, ct);

    [HttpPost("{id:guid}/attempt")]
    [Authorize]
    public Task<ArchitectureResultDto> Attempt(Guid id, ArchitectureAttemptRequest request, CancellationToken ct) =>
        lab.AttemptAsync(id, request, ct);
}

[ApiController]
[Route("api/coding-exercises")]
public class CodingLabController(ICodingLabService lab) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public Task<IReadOnlyList<CodingExerciseListItemDto>> List(
        [FromQuery] string? category, [FromQuery] string? difficulty, [FromQuery] string? search, CancellationToken ct) =>
        lab.ListAsync(category, difficulty, search, ct);

    [HttpGet("categories")]
    [AllowAnonymous]
    public Task<IReadOnlyList<string>> Categories(CancellationToken ct) => lab.CategoriesAsync(ct);

    [HttpGet("{slug}")]
    [AllowAnonymous]
    public Task<CodingExerciseDetailDto> Get(string slug, CancellationToken ct) => lab.GetAsync(slug, ct);

    [HttpPost("{id:guid}/attempt")]
    [Authorize]
    public Task<CodingResultDto> Attempt(Guid id, CodingAttemptRequest request, CancellationToken ct) =>
        lab.AttemptAsync(id, request, ct);
}

[ApiController]
[Route("api/interview")]
public class InterviewController(IInterviewService interview) : ControllerBase
{
    [HttpGet("questions")]
    [AllowAnonymous]
    public Task<IReadOnlyList<InterviewQuestionListItemDto>> List(
        [FromQuery] string? category, [FromQuery] string? difficulty, [FromQuery] string? search, CancellationToken ct) =>
        interview.ListAsync(category, difficulty, search, ct);

    [HttpGet("questions/{id:guid}")]
    [AllowAnonymous]
    public Task<InterviewQuestionDetailDto> Get(Guid id, CancellationToken ct) => interview.GetAsync(id, ct);

    [HttpPost("questions/{id:guid}/attempt")]
    [Authorize]
    public Task<InterviewResultDto> Attempt(Guid id, InterviewAttemptRequest request, CancellationToken ct) =>
        interview.AttemptAsync(id, request, ct);
}

[ApiController]
[Route("api/mock-interview")]
[Authorize]
public class MockInterviewController(IInterviewService interview) : ControllerBase
{
    [HttpPost("start")]
    public Task<MockInterviewStateDto> Start(MockInterviewStartRequest request, CancellationToken ct) =>
        interview.StartMockAsync(request, ct);

    [HttpPost("{id:guid}/answer")]
    public Task<MockInterviewStateDto> Answer(Guid id, MockInterviewAnswerRequest request, CancellationToken ct) =>
        interview.AnswerMockAsync(id, request, ct);

    [HttpPost("{id:guid}/finish")]
    public Task<MockInterviewScorecardDto> Finish(Guid id, CancellationToken ct) =>
        interview.FinishMockAsync(id, ct);

    [HttpGet("latest")]
    public Task<MockInterviewScorecardDto?> Latest(CancellationToken ct) => interview.LatestScorecardAsync(ct);
}
