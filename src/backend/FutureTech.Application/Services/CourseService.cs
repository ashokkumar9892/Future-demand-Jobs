using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface ICourseService
{
    Task<IReadOnlyList<CourseListItemDto>> ListAsync(Guid? careerPathId, string? track, string? search, CancellationToken ct = default);
    Task<CourseDetailDto> GetAsync(string slug, CancellationToken ct = default);
    Task<LessonDetailDto> GetLessonAsync(string slug, CancellationToken ct = default);
    Task<LessonDetailDto> SaveProgressAsync(Guid lessonId, LessonProgressRequest request, CancellationToken ct = default);
    Task<QuizResultDto> SubmitQuizAsync(Guid lessonId, QuizSubmissionRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<VideoDto>> ListVideosAsync(string? search, bool onlyLinked, CancellationToken ct = default);
}

public class CourseService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IDateTimeProvider clock,
    IGamificationService gamification) : ICourseService
{
    public async Task<IReadOnlyList<CourseListItemDto>> ListAsync(
        Guid? careerPathId, string? track, string? search, CancellationToken ct = default)
    {
        var query = db.Courses.AsNoTracking().Include(c => c.CareerPath).AsQueryable();
        if (careerPathId is { } id) query = query.Where(c => c.CareerPathId == id);

        if (!string.IsNullOrWhiteSpace(track))
        {
            var mode = Text.ParseEnum(track, TrackMode.Balanced);
            query = query.Where(c => c.MinimumTrack <= mode);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(c => c.Title.ToLower().Contains(term) || c.Summary.ToLower().Contains(term));
        }

        var courses = await query
            .OrderBy(c => c.CareerPath!.Rank).ThenBy(c => c.Order)
            .Select(c => new
            {
                c.Id, c.PhaseNumber, c.Order, c.Title, c.Slug, c.Summary, c.EstimatedHours,
                c.Level, c.MinimumTrack, CareerTitle = c.CareerPath!.Title,
                ModuleCount = c.Modules.Count,
                LessonIds = c.Modules.SelectMany(m => m.Lessons).Select(l => l.Id).ToList()
            })
            .ToListAsync(ct);

        var completed = await CompletedLessonIdsAsync(ct);

        return courses.Select(c =>
        {
            var done = c.LessonIds.Count(completed.Contains);
            return new CourseListItemDto(
                c.Id, c.PhaseNumber, c.Order, c.Title, c.Slug, c.Summary, c.EstimatedHours,
                Text.Humanize(c.Level), c.MinimumTrack.ToString(), c.CareerTitle,
                c.ModuleCount, c.LessonIds.Count, done,
                c.LessonIds.Count == 0 ? 0 : (int)Math.Round(done * 100.0 / c.LessonIds.Count));
        }).ToList();
    }

    public async Task<CourseDetailDto> GetAsync(string slug, CancellationToken ct = default)
    {
        var course = await db.Courses.AsNoTracking()
            .Include(c => c.CareerPath)
            .Include(c => c.Modules).ThenInclude(m => m.Lessons).ThenInclude(l => l.Videos)
            .Include(c => c.Modules).ThenInclude(m => m.Lessons).ThenInclude(l => l.Quiz)
            .FirstOrDefaultAsync(c => c.Slug == slug, ct)
            ?? throw AppException.NotFound("Course");

        var progress = await ProgressMapAsync(ct);
        var modules = course.Modules.OrderBy(m => m.Order).Select(m =>
        {
            var lessons = m.Lessons.OrderBy(l => l.Order)
                .Select(l => ToLessonListItem(l, progress)).ToList();
            var done = lessons.Count(l => l.Status == nameof(ProgressStatus.Completed));
            return new ModuleDto(m.Id, m.Order, m.Title, m.Summary, m.EstimatedHours, lessons,
                lessons.Count == 0 ? 0 : (int)Math.Round(done * 100.0 / lessons.Count));
        }).ToList();

        var allLessons = modules.SelectMany(m => m.Lessons).ToList();
        var completedCount = allLessons.Count(l => l.Status == nameof(ProgressStatus.Completed));

        var header = new CourseListItemDto(
            course.Id, course.PhaseNumber, course.Order, course.Title, course.Slug, course.Summary,
            course.EstimatedHours, Text.Humanize(course.Level), course.MinimumTrack.ToString(),
            course.CareerPath?.Title ?? string.Empty, modules.Count, allLessons.Count, completedCount,
            allLessons.Count == 0 ? 0 : (int)Math.Round(completedCount * 100.0 / allLessons.Count));

        return new CourseDetailDto(header, Text.Lines(course.Outcomes), modules);
    }

    public async Task<LessonDetailDto> GetLessonAsync(string slug, CancellationToken ct = default)
    {
        var lesson = await db.Lessons.AsNoTracking()
            .Include(l => l.Resources)
            .Include(l => l.Videos)
            .Include(l => l.Quiz)!.ThenInclude(q => q!.Questions).ThenInclude(q => q.Options)
            .Include(l => l.Module)!.ThenInclude(m => m!.Course)
            .FirstOrDefaultAsync(l => l.Slug == slug, ct)
            ?? throw AppException.NotFound("Lesson");

        return await BuildLessonDetailAsync(lesson, ct);
    }

    public async Task<LessonDetailDto> SaveProgressAsync(Guid lessonId, LessonProgressRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var lesson = await db.Lessons.AsNoTracking().FirstOrDefaultAsync(l => l.Id == lessonId, ct)
                     ?? throw AppException.NotFound("Lesson");

        var record = await db.LessonProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId, ct);
        if (record is null)
        {
            record = new LessonProgress { UserId = userId, LessonId = lessonId };
            db.LessonProgress.Add(record);
        }

        var wasCompleted = record.Status == ProgressStatus.Completed;
        var status = Text.ParseEnum(request.Status, ProgressStatus.InProgress);

        record.Status = status;
        record.VideoWatched = record.VideoWatched || request.VideoWatched;
        record.MinutesSpent += Math.Max(0, request.MinutesSpent);
        record.UpdatedAt = clock.Now;
        if (status == ProgressStatus.Completed && record.CompletedAt is null) record.CompletedAt = clock.Now;

        var xp = status == ProgressStatus.Completed && !wasCompleted ? Xp.LessonCompleted : 0;
        gamification.Record(userId, xp, $"Lesson: {lesson.Title}", "lesson", lessonId,
            Math.Max(0, request.MinutesSpent), request.VideoWatched ? StudyActivityType.Video : StudyActivityType.Reading);

        await MarkPlanItemCompleteAsync(userId, "lesson", lessonId, status == ProgressStatus.Completed, ct);
        await db.SaveChangesAsync(ct);
        await gamification.EvaluateBadgesAsync(userId, ct);
        await db.SaveChangesAsync(ct);

        return await GetLessonAsync(lesson.Slug, ct);
    }

    public async Task<QuizResultDto> SubmitQuizAsync(Guid lessonId, QuizSubmissionRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var quiz = await db.Quizzes.AsNoTracking()
            .Include(q => q.Questions).ThenInclude(q => q.Options)
            .FirstOrDefaultAsync(q => q.LessonId == lessonId, ct)
            ?? throw AppException.NotFound("Quiz");

        var results = new List<QuizQuestionResultDto>();
        var correctCount = 0;

        foreach (var question in quiz.Questions.OrderBy(q => q.Order))
        {
            var correctIds = question.Options.Where(o => o.IsCorrect).Select(o => o.Id).OrderBy(x => x).ToList();
            var selected = request.Answers.FirstOrDefault(a => a.QuestionId == question.Id)?.SelectedOptionIds
                               .OrderBy(x => x).ToList() ?? [];
            var correct = correctIds.SequenceEqual(selected);
            if (correct) correctCount++;
            results.Add(new QuizQuestionResultDto(question.Id, correct, correctIds, question.Explanation));
        }

        var score = quiz.Questions.Count == 0 ? 0 : (int)Math.Round(correctCount * 100.0 / quiz.Questions.Count);
        var passed = score >= quiz.PassMarkPercent;

        var record = await db.LessonProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId, ct);
        if (record is null)
        {
            record = new LessonProgress { UserId = userId, LessonId = lessonId, Status = ProgressStatus.InProgress };
            db.LessonProgress.Add(record);
        }
        // Keep the learner's best attempt; retries should never lower a score.
        record.QuizScorePercent = Math.Max(record.QuizScorePercent ?? 0, score);
        record.UpdatedAt = clock.Now;

        var xp = passed ? Xp.QuizPassed : 0;
        gamification.Record(userId, xp, "Quiz completed", "quiz", quiz.Id, 10, StudyActivityType.Quiz);
        await MarkPlanItemCompleteAsync(userId, "quiz", lessonId, passed, ct);
        await db.SaveChangesAsync(ct);
        await gamification.EvaluateBadgesAsync(userId, ct);
        await db.SaveChangesAsync(ct);

        return new QuizResultDto(score, passed, xp, results);
    }

    public async Task<IReadOnlyList<VideoDto>> ListVideosAsync(string? search, bool onlyLinked, CancellationToken ct = default)
    {
        var query = db.Videos.AsNoTracking().Include(v => v.Lesson).AsQueryable();
        if (onlyLinked) query = query.Where(v => v.YouTubeUrl != null && v.YouTubeUrl != "");
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(v => v.Title.ToLower().Contains(term) || v.Lesson!.Title.ToLower().Contains(term));
        }

        return await query.OrderBy(v => v.Title)
            .Select(v => new VideoDto(
                v.Id, v.Title, v.YouTubeUrl, v.Instructor, v.DurationMinutes,
                v.SkillLevel.ToString(), v.IsVerified, v.LessonId, v.Lesson!.Title, v.Lesson.Slug))
            .ToListAsync(ct);
    }

    // ----- helpers -------------------------------------------------------

    private async Task<LessonDetailDto> BuildLessonDetailAsync(Lesson lesson, CancellationToken ct)
    {
        var course = lesson.Module?.Course ?? throw AppException.NotFound("Course for lesson");
        var progressMap = await ProgressMapAsync(ct);
        progressMap.TryGetValue(lesson.Id, out var progress);

        var navigation = await db.Lessons.AsNoTracking()
            .Where(l => l.Module!.CourseId == course.Id)
            .OrderBy(l => l.Module!.Order).ThenBy(l => l.Order)
            .Select(l => new { l.Id, l.Title, l.Slug, l.Order, ModuleTitle = l.Module!.Title })
            .ToListAsync(ct);

        var nav = navigation.Select(n => new LessonNavItemDto(
            n.Id, n.Title, n.Slug,
            progressMap.TryGetValue(n.Id, out var p) ? p.Status.ToString() : nameof(ProgressStatus.NotStarted),
            n.Order, n.ModuleTitle)).ToList();

        var index = nav.FindIndex(n => n.Id == lesson.Id);
        var previous = index > 0 ? nav[index - 1] : null;
        var next = index >= 0 && index < nav.Count - 1 ? nav[index + 1] : null;

        // Related practice is matched on lesson keywords so the right rail always
        // offers something to attempt straight after the reading.
        var keywords = lesson.Title.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 4).Take(3).ToList();
        var relatedPractice = new List<PracticeListItemDto>();
        if (keywords.Count > 0)
        {
            var candidates = await db.PracticeQuestions.AsNoTracking().Take(200).ToListAsync(ct);
            relatedPractice = candidates
                .Where(q => keywords.Any(k =>
                    q.Tags.Contains(k, StringComparison.OrdinalIgnoreCase) ||
                    q.Prompt.Contains(k, StringComparison.OrdinalIgnoreCase)))
                .Take(3)
                .Select(q => new PracticeListItemDto(
                    q.Id, q.Category, q.Mode.ToString(), q.Prompt, q.Tags, q.EstimatedMinutes, null, 0))
                .ToList();
        }

        var isBookmarked = currentUser.UserId is { } uid &&
            await db.Bookmarks.AsNoTracking().AnyAsync(
                b => b.UserId == uid && b.ItemType == BookmarkItemType.Lesson && b.RefId == lesson.Id, ct);

        return new LessonDetailDto(
            lesson.Id, lesson.Title, lesson.Slug, Text.Humanize(lesson.Type), lesson.EstimatedMinutes,
            lesson.ContentMarkdown, lesson.CodeExample, lesson.CodeLanguage, lesson.DiagramMermaid,
            Text.Lines(lesson.KeyTakeaways),
            lesson.Resources.Select(r => new LessonResourceDto(r.Id, r.Title, r.Url, Text.Humanize(r.Kind))).ToList(),
            lesson.Videos.Select(v => new VideoDto(
                v.Id, v.Title, v.YouTubeUrl, v.Instructor, v.DurationMinutes,
                v.SkillLevel.ToString(), v.IsVerified, v.LessonId, lesson.Title, lesson.Slug)).ToList(),
            lesson.Quiz is null ? null : new QuizDto(
                lesson.Quiz.Id, lesson.Quiz.Title, lesson.Quiz.PassMarkPercent,
                lesson.Quiz.Questions.OrderBy(q => q.Order).Select(q => new QuizQuestionDto(
                    q.Id, q.Order, q.Prompt, q.AllowsMultiple,
                    q.Options.OrderBy(o => o.Order).Select(o => new QuizOptionDto(o.Id, o.Order, o.Text)).ToList())).ToList()),
            course.Id, course.Title, course.Slug, lesson.Module!.Title,
            progress?.Status.ToString() ?? nameof(ProgressStatus.NotStarted),
            progress?.VideoWatched ?? false,
            progress?.MinutesSpent ?? 0,
            progress?.QuizScorePercent,
            isBookmarked,
            nav, previous, next, relatedPractice);
    }

    private static LessonListItemDto ToLessonListItem(Lesson l, IReadOnlyDictionary<Guid, LessonProgress> progress)
    {
        progress.TryGetValue(l.Id, out var p);
        return new LessonListItemDto(
            l.Id, l.Order, l.Title, l.Slug, Text.Humanize(l.Type), l.EstimatedMinutes,
            p?.Status.ToString() ?? nameof(ProgressStatus.NotStarted),
            p?.VideoWatched ?? false, p?.QuizScorePercent,
            l.Videos.Count > 0, l.Quiz is not null, l.MinimumTrack.ToString());
    }

    private async Task<Dictionary<Guid, LessonProgress>> ProgressMapAsync(CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId) return [];
        return await db.LessonProgress.AsNoTracking()
            .Where(p => p.UserId == userId)
            .ToDictionaryAsync(p => p.LessonId, p => p, ct);
    }

    private async Task<HashSet<Guid>> CompletedLessonIdsAsync(CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId) return [];
        var ids = await db.LessonProgress.AsNoTracking()
            .Where(p => p.UserId == userId && p.Status == ProgressStatus.Completed)
            .Select(p => p.LessonId).ToListAsync(ct);
        return ids.ToHashSet();
    }

    /// <summary>Ticks off the matching item on today's plan so the calendar stays in sync.</summary>
    private async Task MarkPlanItemCompleteAsync(Guid userId, string refType, Guid refId, bool completed, CancellationToken ct)
    {
        if (!completed) return;
        var items = await db.StudyPlanItems
            .Include(i => i.Day)
            .Where(i => i.Day!.UserId == userId && i.RefType == refType && i.RefId == refId && i.Status != PlanStatus.Completed)
            .ToListAsync(ct);

        foreach (var item in items)
        {
            item.Status = PlanStatus.Completed;
            item.CompletedAt = clock.Now;
            if (item.Day is not null && item.Day.Items.All(i => i.Status == PlanStatus.Completed))
                item.Day.Status = PlanStatus.Completed;
        }
    }
}
