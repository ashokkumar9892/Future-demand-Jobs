using FutureTech.Domain.Common;

namespace FutureTech.Application.Abstractions;

public interface ICurrentUser
{
    Guid? UserId { get; }
    string? Email { get; }
    UserRole Role { get; }
    bool IsAuthenticated { get; }
    /// <summary>Throws when unauthenticated. Used by every per-user use case.</summary>
    Guid RequireUserId();
}

public interface IJwtTokenService
{
    (string Token, DateTimeOffset ExpiresAt) Issue(Guid userId, string email, UserRole role);
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface IDateTimeProvider
{
    DateTimeOffset Now { get; }
    DateOnly Today { get; }
}

/// <summary>
/// Scores a free-text answer against a rubric.
/// <para>
/// The shipped implementation is deterministic and offline: it scores rubric
/// coverage, structure and depth. It never claims to be an LLM. Swapping in a
/// model-backed implementation only requires registering a different class.
/// </para>
/// </summary>
public interface IAnswerEvaluator
{
    AnswerEvaluation Evaluate(string answer, string rubricJson, string modelAnswer);
}

public record RubricDimensionScore(string Dimension, int Score, double Weight, string Comment);

public record AnswerEvaluation(
    int Score,
    IReadOnlyList<RubricDimensionScore> Dimensions,
    IReadOnlyList<string> Strengths,
    IReadOnlyList<string> Weaknesses,
    string Method);
