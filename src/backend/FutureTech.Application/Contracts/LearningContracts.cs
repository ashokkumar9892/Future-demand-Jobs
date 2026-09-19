namespace FutureTech.Application.Contracts;

public record CourseListItemDto(
    Guid Id, int PhaseNumber, int Order, string Title, string Slug, string Summary,
    int EstimatedHours, string Level, string MinimumTrack, string CareerTitle,
    int ModuleCount, int LessonCount, int CompletedLessons, int ProgressPercent);

public record LessonListItemDto(
    Guid Id, int Order, string Title, string Slug, string Type, int EstimatedMinutes,
    string Status, bool VideoWatched, int? QuizScorePercent, bool HasVideo, bool HasQuiz,
    string MinimumTrack);

public record ModuleDto(
    Guid Id, int Order, string Title, string Summary, double EstimatedHours,
    IReadOnlyList<LessonListItemDto> Lessons, int ProgressPercent);

public record CourseDetailDto(
    CourseListItemDto Course,
    IReadOnlyList<string> Outcomes,
    IReadOnlyList<ModuleDto> Modules);

public record VideoDto(
    Guid Id, string Title, string? YouTubeUrl, string? Instructor,
    int DurationMinutes, string SkillLevel, bool IsVerified, Guid LessonId,
    string? LessonTitle, string? LessonSlug);

public record LessonResourceDto(Guid Id, string Title, string Url, string Kind);

public record QuizOptionDto(Guid Id, int Order, string Text);

public record QuizQuestionDto(Guid Id, int Order, string Prompt, bool AllowsMultiple, IReadOnlyList<QuizOptionDto> Options);

public record QuizDto(Guid Id, string Title, int PassMarkPercent, IReadOnlyList<QuizQuestionDto> Questions);

public record LessonNavItemDto(Guid Id, string Title, string Slug, string Status, int Order, string ModuleTitle);

public record LessonDetailDto(
    Guid Id,
    string Title,
    string Slug,
    string Type,
    int EstimatedMinutes,
    string ContentMarkdown,
    string? CodeExample,
    string CodeLanguage,
    string? DiagramMermaid,
    IReadOnlyList<string> KeyTakeaways,
    IReadOnlyList<LessonResourceDto> Resources,
    IReadOnlyList<VideoDto> Videos,
    QuizDto? Quiz,
    Guid CourseId,
    string CourseTitle,
    string CourseSlug,
    string ModuleTitle,
    string Status,
    bool VideoWatched,
    int MinutesSpent,
    int? QuizScorePercent,
    bool IsBookmarked,
    IReadOnlyList<LessonNavItemDto> CourseNavigation,
    LessonNavItemDto? Previous,
    LessonNavItemDto? Next,
    IReadOnlyList<PracticeListItemDto> RelatedPractice);

public record LessonProgressRequest(string Status, int MinutesSpent, bool VideoWatched);

public record QuizAnswerDto(Guid QuestionId, IReadOnlyList<Guid> SelectedOptionIds);

public record QuizSubmissionRequest(IReadOnlyList<QuizAnswerDto> Answers);

public record QuizQuestionResultDto(Guid QuestionId, bool Correct, IReadOnlyList<Guid> CorrectOptionIds, string Explanation);

public record QuizResultDto(int ScorePercent, bool Passed, int XpAwarded, IReadOnlyList<QuizQuestionResultDto> Results);
