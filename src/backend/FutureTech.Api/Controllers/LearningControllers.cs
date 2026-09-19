using FutureTech.Application.Contracts;
using FutureTech.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FutureTech.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService auth) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    public Task<AuthResponse> Register(RegisterRequest request, CancellationToken ct) => auth.RegisterAsync(request, ct);

    [HttpPost("login")]
    [AllowAnonymous]
    public Task<AuthResponse> Login(LoginRequest request, CancellationToken ct) => auth.LoginAsync(request, ct);

    [HttpGet("me")]
    [Authorize]
    public Task<UserProfileDto> Me(CancellationToken ct) => auth.MeAsync(ct);

    public record ThemeRequest(string Theme);

    [HttpPut("theme")]
    [Authorize]
    public Task<UserProfileDto> Theme(ThemeRequest request, CancellationToken ct) =>
        auth.UpdateThemeAsync(request.Theme, ct);
}

[ApiController]
[Route("api/careers")]
public class CareersController(ICareerService careers) : ControllerBase
{
    /// <summary>Ranked career paths. Readable without signing in so the catalog is browsable.</summary>
    [HttpGet]
    [AllowAnonymous]
    public Task<IReadOnlyList<CareerSummaryDto>> List(
        [FromQuery] string? search, [FromQuery] string? sort, [FromQuery] string? country,
        CancellationToken ct) =>
        careers.ListAsync(search, sort, country, ct);

    [HttpGet("{slug}")]
    [AllowAnonymous]
    public Task<CareerDetailDto> Get(string slug, [FromQuery] string? country, CancellationToken ct) =>
        careers.GetAsync(slug, country, ct);

    [HttpGet("{slug}/ladder")]
    [AllowAnonymous]
    public Task<IReadOnlyList<LadderStageDto>> Ladder(string slug, CancellationToken ct) =>
        careers.GetLadderAsync(slug, ct);

    [HttpGet("{slug}/skill-gap")]
    [Authorize]
    public Task<IReadOnlyList<SkillGapEntryDto>> SkillGap(string slug, CancellationToken ct) =>
        careers.GetSkillGapAsync(slug, ct);
}

[ApiController]
[Route("api/roadmap")]
[Authorize]
public class RoadmapController(IRoadmapService roadmap) : ControllerBase
{
    [HttpGet]
    public Task<RoadmapDto> Get([FromQuery] Guid? careerPathId, CancellationToken ct) =>
        roadmap.GetAsync(careerPathId, ct);
}

[ApiController]
[Route("api/courses")]
public class CoursesController(ICourseService courses) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public Task<IReadOnlyList<CourseListItemDto>> List(
        [FromQuery] Guid? careerPathId, [FromQuery] string? track, [FromQuery] string? search,
        [FromQuery] string? country, CancellationToken ct) =>
        courses.ListAsync(careerPathId, track, search, country, ct);

    [HttpGet("{slug}")]
    [AllowAnonymous]
    public Task<CourseDetailDto> Get(string slug, CancellationToken ct) => courses.GetAsync(slug, ct);
}

[ApiController]
[Route("api/lessons")]
public class LessonsController(ICourseService courses) : ControllerBase
{
    [HttpGet("{slug}")]
    [AllowAnonymous]
    public Task<LessonDetailDto> Get(string slug, CancellationToken ct) => courses.GetLessonAsync(slug, ct);

    [HttpPost("{id:guid}/progress")]
    [Authorize]
    public Task<LessonDetailDto> Progress(Guid id, LessonProgressRequest request, CancellationToken ct) =>
        courses.SaveProgressAsync(id, request, ct);

    [HttpPost("{id:guid}/quiz")]
    [Authorize]
    public Task<QuizResultDto> Quiz(Guid id, QuizSubmissionRequest request, CancellationToken ct) =>
        courses.SubmitQuizAsync(id, request, ct);
}

[ApiController]
[Route("api/videos")]
public class VideosController(ICourseService courses) : ControllerBase
{
    /// <summary>
    /// Video library. Entries with no URL are placeholders awaiting a verified
    /// link from Admin — the platform never invents video URLs.
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public Task<IReadOnlyList<VideoDto>> List(
        [FromQuery] string? search, [FromQuery] bool onlyLinked = false, CancellationToken ct = default) =>
        courses.ListVideosAsync(search, onlyLinked, ct);
}

[ApiController]
[Route("api/study")]
[Authorize]
public class StudyController(IStudyPlannerService planner) : ControllerBase
{
    [HttpGet("profile")]
    public Task<StudyProfileDto> Profile(CancellationToken ct) => planner.GetProfileAsync(ct);

    [HttpPut("profile")]
    public Task<StudyProfileDto> UpdateProfile(StudyProfileUpdateRequest request, CancellationToken ct) =>
        planner.UpdateProfileAsync(request, ct);

    [HttpPost("calculate")]
    [AllowAnonymous]
    public Task<StudyCalculationDto> Calculate(StudyCalculationRequest request, CancellationToken ct) =>
        planner.CalculateAsync(request, ct);

    [HttpGet("plan")]
    public Task<IReadOnlyList<StudyPlanDayDto>> Plan(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct) =>
        planner.GetPlanAsync(from, to, ct);

    [HttpPost("plan/generate")]
    public Task<IReadOnlyList<StudyPlanDayDto>> Generate(GeneratePlanRequest request, CancellationToken ct) =>
        planner.GeneratePlanAsync(request, ct);

    [HttpPost("plan/items/{id:guid}/complete")]
    public Task<StudyPlanItemDto> CompleteItem(Guid id, CancellationToken ct) => planner.CompleteItemAsync(id, ct);

    [HttpGet("today")]
    public Task<StudyPlanDayDto?> Today(CancellationToken ct) => planner.GetTodayAsync(ct);

    /// <summary>Backs the START TODAY'S TRAINING button: marks the next item active and returns its route.</summary>
    [HttpPost("start-today")]
    public Task<StartTodayResponse> StartToday(CancellationToken ct) => planner.StartTodayAsync(ct);

    [HttpGet("calendar/{year:int}/{month:int}")]
    public Task<CalendarMonthDto> Calendar(int year, int month, CancellationToken ct) =>
        planner.GetMonthAsync(year, month, ct);
}
