using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IInterviewService
{
    Task<IReadOnlyList<InterviewQuestionListItemDto>> ListAsync(string? category, string? difficulty, string? search, CancellationToken ct = default);
    Task<InterviewQuestionDetailDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<InterviewResultDto> AttemptAsync(Guid id, InterviewAttemptRequest request, CancellationToken ct = default);

    Task<MockInterviewStateDto> StartMockAsync(MockInterviewStartRequest request, CancellationToken ct = default);
    Task<MockInterviewStateDto> AnswerMockAsync(Guid sessionId, MockInterviewAnswerRequest request, CancellationToken ct = default);
    Task<MockInterviewScorecardDto> FinishMockAsync(Guid sessionId, CancellationToken ct = default);
    Task<MockInterviewScorecardDto?> LatestScorecardAsync(CancellationToken ct = default);
}

public class InterviewService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IDateTimeProvider clock,
    IAnswerEvaluator evaluator,
    IGamificationService gamification) : IInterviewService
{
    public async Task<IReadOnlyList<InterviewQuestionListItemDto>> ListAsync(
        string? category, string? difficulty, string? search, CancellationToken ct = default)
    {
        var query = db.InterviewQuestions.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(category))
        {
            var parsed = Text.ParseEnum(category, InterviewCategory.Technical);
            query = query.Where(q => q.Category == parsed);
        }
        if (!string.IsNullOrWhiteSpace(difficulty))
        {
            var level = Text.ParseEnum(difficulty, DifficultyLevel.Intermediate);
            query = query.Where(q => q.Difficulty == level);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(q => q.Question.ToLower().Contains(term));
        }

        var questions = await query.OrderBy(q => q.Category).ThenBy(q => q.Difficulty).ToListAsync(ct);
        var stats = await StatsAsync(ct);

        return questions.Select(q =>
        {
            stats.TryGetValue(q.Id, out var stat);
            return new InterviewQuestionListItemDto(
                q.Id, Text.Humanize(q.Category), Text.Humanize(q.Difficulty), q.Question,
                q.TimeLimitSeconds, stat.Count == 0 ? null : stat.Best, stat.Count);
        }).ToList();
    }

    public async Task<InterviewQuestionDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var question = await db.InterviewQuestions.AsNoTracking().FirstOrDefaultAsync(q => q.Id == id, ct)
                       ?? throw AppException.NotFound("Interview question");
        var stats = await StatsAsync(ct);
        var bookmarked = currentUser.UserId is { } userId &&
            await db.Bookmarks.AsNoTracking().AnyAsync(
                b => b.UserId == userId && b.ItemType == BookmarkItemType.InterviewQuestion && b.RefId == id, ct);

        return new InterviewQuestionDetailDto(
            question.Id, Text.Humanize(question.Category), Text.Humanize(question.Difficulty),
            question.Question, question.Tips, question.TimeLimitSeconds,
            Text.FromJson<List<string>>(question.FollowUpsJson) ?? [],
            stats.TryGetValue(id, out var stat) && stat.Count > 0 ? stat.Best : null,
            bookmarked);
    }

    public async Task<InterviewResultDto> AttemptAsync(Guid id, InterviewAttemptRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var question = await db.InterviewQuestions.AsNoTracking().FirstOrDefaultAsync(q => q.Id == id, ct)
                       ?? throw AppException.NotFound("Interview question");

        if (string.IsNullOrWhiteSpace(request.AnswerText))
            throw new AppException("Record an answer before submitting.");

        var evaluation = evaluator.Evaluate(request.AnswerText, question.RubricJson, question.SuggestedAnswer);
        var dimensions = evaluation.Dimensions.Select(d => new DimensionScoreDto(d.Dimension, d.Score, d.Weight, d.Comment)).ToList();

        db.InterviewAttempts.Add(new InterviewAttempt
        {
            UserId = userId,
            InterviewQuestionId = id,
            AnswerText = request.AnswerText,
            Score = evaluation.Score,
            Feedback = string.Join('\n', evaluation.Weaknesses),
            SecondsTaken = Math.Max(0, request.SecondsTaken)
        });

        gamification.Record(userId, Xp.InterviewAttempt, "Interview practice", "interview", id,
            Math.Max(5, request.SecondsTaken / 60), StudyActivityType.Interview);

        await db.SaveChangesAsync(ct);
        await gamification.EvaluateBadgesAsync(userId, ct);
        await db.SaveChangesAsync(ct);

        return new InterviewResultDto(
            evaluation.Score, dimensions, evaluation.Strengths, evaluation.Weaknesses,
            question.SuggestedAnswer, evaluation.Method, Xp.InterviewAttempt);
    }

    // ----- mock interview ------------------------------------------------

    public async Task<MockInterviewStateDto> StartMockAsync(MockInterviewStartRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var profile = await db.StudyProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
        var careerId = request.CareerPathId ?? profile?.TargetCareerPathId;

        var career = careerId is { } id
            ? await db.CareerPaths.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct)
            : await db.CareerPaths.AsNoTracking().OrderBy(c => c.Rank).FirstOrDefaultAsync(ct);
        if (career is null) throw AppException.NotFound("Career path");

        var count = Math.Clamp(request.QuestionCount <= 0 ? 5 : request.QuestionCount, 3, 10);

        // One question per category where possible, so the scorecard has signal
        // on every dimension rather than five variations of the same topic.
        var pool = await db.InterviewQuestions.AsNoTracking()
            .Where(q => q.CareerPathId == career.Id || q.CareerPathId == null)
            .ToListAsync(ct);
        if (pool.Count == 0) throw AppException.NotFound("Interview questions");

        var picked = pool
            .GroupBy(q => q.Category)
            .OrderBy(_ => Guid.NewGuid())
            .Select(g => g.OrderBy(_ => Guid.NewGuid()).First())
            .Take(count)
            .ToList();
        while (picked.Count < count && picked.Count < pool.Count)
            picked.Add(pool.Where(p => picked.All(x => x.Id != p.Id)).OrderBy(_ => Guid.NewGuid()).First());

        var session = new MockInterviewSession { UserId = userId, CareerPathId = career.Id };

        // Orders are spaced by 10 so a follow-up can be inserted immediately
        // after its parent without renumbering the turns that come later.
        var order = 10;
        foreach (var question in picked)
        {
            session.Turns.Add(new MockInterviewTurn
            {
                Order = order,
                InterviewQuestionId = question.Id,
                Question = question.Question
            });
            order += 10;
        }

        db.MockInterviewSessions.Add(session);
        await db.SaveChangesAsync(ct);

        return BuildState(session, career.Title);
    }

    public async Task<MockInterviewStateDto> AnswerMockAsync(Guid sessionId, MockInterviewAnswerRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var session = await db.MockInterviewSessions.Include(s => s.Turns)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId, ct)
            ?? throw AppException.NotFound("Mock interview session");
        if (session.CompletedAt is not null) throw new AppException("This interview has already finished.");

        var turn = session.Turns.Where(t => string.IsNullOrEmpty(t.AnswerText)).OrderBy(t => t.Order).FirstOrDefault()
                   ?? throw new AppException("Every question has been answered. Finish the interview to see your scorecard.");

        if (string.IsNullOrWhiteSpace(request.AnswerText)) throw new AppException("Answer the question before continuing.");

        var source = turn.InterviewQuestionId is { } qid
            ? await db.InterviewQuestions.AsNoTracking().FirstOrDefaultAsync(q => q.Id == qid, ct)
            : null;

        var evaluation = evaluator.Evaluate(request.AnswerText, source?.RubricJson ?? "[]", source?.SuggestedAnswer ?? string.Empty);
        turn.AnswerText = request.AnswerText;
        turn.TurnScore = evaluation.Score;
        turn.Feedback = string.Join('\n', evaluation.Weaknesses.Take(2).Concat(evaluation.Strengths.Take(1)));

        // A weak answer earns one follow-up, the way a real panel would probe.
        // Capped at one per question so a struggling candidate is not trapped
        // in an interview that never ends.
        var followUps = Text.FromJson<List<string>>(source?.FollowUpsJson ?? "[]") ?? [];
        var alreadyFollowedUp = session.Turns.Any(
            t => t.IsFollowUp && t.InterviewQuestionId == turn.InterviewQuestionId);

        if (evaluation.Score < 70 && followUps.Count > 0 && !alreadyFollowedUp && !turn.IsFollowUp)
        {
            db.MockInterviewTurns.Add(new MockInterviewTurn
            {
                MockInterviewSessionId = session.Id,
                Order = turn.Order + 1,
                InterviewQuestionId = turn.InterviewQuestionId,
                Question = followUps[0],
                IsFollowUp = true
            });
        }

        await db.SaveChangesAsync(ct);
        var careerTitle = await db.CareerPaths.AsNoTracking()
            .Where(c => c.Id == session.CareerPathId).Select(c => c.Title).FirstOrDefaultAsync(ct) ?? string.Empty;
        return BuildState(session, careerTitle);
    }

    public async Task<MockInterviewScorecardDto> FinishMockAsync(Guid sessionId, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var session = await db.MockInterviewSessions.Include(s => s.Turns)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId, ct)
            ?? throw AppException.NotFound("Mock interview session");

        var answered = session.Turns.Where(t => !string.IsNullOrEmpty(t.AnswerText)).ToList();
        if (answered.Count == 0) throw new AppException("Answer at least one question before finishing.");

        var questionIds = answered.Where(t => t.InterviewQuestionId is not null)
            .Select(t => t.InterviewQuestionId!.Value).Distinct().ToList();
        var categories = await db.InterviewQuestions.AsNoTracking()
            .Where(q => questionIds.Contains(q.Id))
            .ToDictionaryAsync(q => q.Id, q => q.Category, ct);

        int ScoreFor(params InterviewCategory[] wanted)
        {
            var relevant = answered.Where(t =>
                t.InterviewQuestionId is { } id && categories.TryGetValue(id, out var cat) && wanted.Contains(cat)).ToList();
            var source = relevant.Count > 0 ? relevant : answered;
            return (int)Math.Round(source.Average(t => (double)t.TurnScore));
        }

        var overallBase = (int)Math.Round(answered.Average(t => (double)t.TurnScore));
        session.Communication = Communication(answered);
        session.TechnicalKnowledge = ScoreFor(InterviewCategory.Technical, InterviewCategory.Cloud, InterviewCategory.Coding);
        session.Architecture = ScoreFor(InterviewCategory.Architecture, InterviewCategory.SystemDesign);
        session.ProblemSolving = ScoreFor(InterviewCategory.SystemDesign, InterviewCategory.Technical);
        session.SecurityAwareness = SecurityAwareness(answered);
        session.OverallScore = (int)Math.Round(
            session.Communication * 0.2 + session.TechnicalKnowledge * 0.25 + session.Architecture * 0.25 +
            session.ProblemSolving * 0.2 + session.SecurityAwareness * 0.1);
        session.CompletedAt = clock.Now;
        session.Recommendations = string.Join('\n', Recommendations(session, overallBase));

        gamification.Record(userId, Xp.MockInterviewCompleted, "Mock interview completed", "mock-interview",
            session.Id, answered.Count * 5, StudyActivityType.Interview);

        await db.SaveChangesAsync(ct);
        await gamification.EvaluateBadgesAsync(userId, ct);
        await db.SaveChangesAsync(ct);

        return ToScorecard(session);
    }

    public async Task<MockInterviewScorecardDto?> LatestScorecardAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var session = await db.MockInterviewSessions.AsNoTracking().Include(s => s.Turns)
            .Where(s => s.UserId == userId && s.CompletedAt != null)
            .OrderByDescending(s => s.CompletedAt).FirstOrDefaultAsync(ct);
        return session is null ? null : ToScorecard(session);
    }

    // ----- helpers -------------------------------------------------------

    /// <summary>
    /// Communication is judged on how the answer is delivered — length, structure
    /// and signposting — rather than on whether the technical content is right.
    /// </summary>
    private static int Communication(IReadOnlyCollection<MockInterviewTurn> turns)
    {
        var scores = turns.Select(t =>
        {
            var words = t.AnswerText.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
            var lengthScore = words switch { < 30 => 40, < 80 => 70, < 350 => 90, _ => 70 };
            var structure = t.AnswerText.Contains('\n') || t.AnswerText.Contains("First", StringComparison.OrdinalIgnoreCase)
                            || t.AnswerText.Contains("then", StringComparison.OrdinalIgnoreCase) ? 10 : 0;
            return Math.Min(100, lengthScore + structure);
        }).ToList();
        return (int)Math.Round(scores.Average());
    }

    private static int SecurityAwareness(IReadOnlyCollection<MockInterviewTurn> turns)
    {
        string[] markers =
        [
            "security", "authentication", "authorization", "rbac", "managed identity", "key vault",
            "secret", "encryption", "pii", "least privilege", "audit", "prompt injection", "private endpoint"
        ];
        var hits = turns.Select(t => markers.Count(m => t.AnswerText.Contains(m, StringComparison.OrdinalIgnoreCase))).ToList();
        return Math.Min(100, (int)Math.Round(hits.Average() * 25));
    }

    private static IEnumerable<string> Recommendations(MockInterviewSession s, int baseScore)
    {
        if (s.Architecture < 70) yield return "Rehearse end-to-end architecture walkthroughs: context, components, data flow, failure modes, cost.";
        if (s.SecurityAwareness < 70) yield return "Name concrete controls unprompted — managed identity, Key Vault, private endpoints, PII handling, prompt-injection defences.";
        if (s.Communication < 70) yield return "Structure answers explicitly: requirements, options considered, decision, trade-offs.";
        if (s.TechnicalKnowledge < 70) yield return "Deepen hands-on work in the target stack and quote specific services, limits and SLAs.";
        if (s.ProblemSolving < 70) yield return "State assumptions out loud and quantify: users, RPS, latency budget, token cost.";
        if (baseScore >= 80) yield return "Strong baseline. Add measurable outcomes (latency, cost per request, adoption) to make answers memorable.";
        yield return "Repeat this mock weekly and compare the five dimensions over time.";
    }

    private static MockInterviewStateDto BuildState(MockInterviewSession session, string careerTitle)
    {
        // Stored orders are sparse (10, 11, 20...) so follow-ups can be inserted;
        // the client sees a simple sequence.
        var turns = session.Turns.OrderBy(t => t.Order)
            .Select((t, i) => ToTurnDto(t, i + 1)).ToList();
        var current = turns.FirstOrDefault(t => string.IsNullOrEmpty(t.AnswerText));
        return new MockInterviewStateDto(
            session.Id, careerTitle,
            turns.Count(t => !string.IsNullOrEmpty(t.AnswerText)), turns.Count,
            current, current is null, turns);
    }

    private static MockInterviewScorecardDto ToScorecard(MockInterviewSession s) => new(
        s.Id, s.Communication, s.TechnicalKnowledge, s.Architecture, s.ProblemSolving,
        s.SecurityAwareness, s.OverallScore, Text.Lines(s.Recommendations),
        s.Turns.OrderBy(t => t.Order).Select((t, i) => ToTurnDto(t, i + 1)).ToList(),
        Disclaimers.DeterministicEvaluator);

    private static MockInterviewTurnDto ToTurnDto(MockInterviewTurn t, int displayOrder) => new(
        t.Id, displayOrder, t.Question, t.IsFollowUp,
        string.IsNullOrEmpty(t.AnswerText) ? null : t.AnswerText,
        string.IsNullOrEmpty(t.AnswerText) ? null : t.TurnScore,
        string.IsNullOrEmpty(t.Feedback) ? null : t.Feedback);

    private async Task<Dictionary<Guid, (int Best, int Count)>> StatsAsync(CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId) return [];
        var rows = await db.InterviewAttempts.AsNoTracking()
            .Where(a => a.UserId == userId)
            .GroupBy(a => a.InterviewQuestionId)
            .Select(g => new { g.Key, Best = g.Max(a => a.Score), Count = g.Count() })
            .ToListAsync(ct);
        return rows.ToDictionary(r => r.Key, r => (r.Best, r.Count));
    }
}
