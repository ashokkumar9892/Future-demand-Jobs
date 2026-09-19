using System.Text.Json;
using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;

namespace FutureTech.Infrastructure.Evaluation;

/// <summary>
/// Deterministic, offline rubric scorer.
/// <para>
/// For each rubric dimension it measures how many of the expected concepts the
/// answer actually names, then adjusts for depth (length) and structure. It does
/// not use a language model and never claims to; <see cref="AnswerEvaluation.Method"/>
/// carries that statement through to the UI. Swapping in a model-backed
/// <see cref="IAnswerEvaluator"/> is a DI registration change only.
/// </para>
/// </summary>
public class RubricAnswerEvaluator : IAnswerEvaluator
{
    private sealed record RubricSpec(string Dimension, double Weight, List<string>? Keywords, string? Guidance);

    public AnswerEvaluation Evaluate(string answer, string rubricJson, string modelAnswer)
    {
        var text = (answer ?? string.Empty).Trim();
        var lower = text.ToLowerInvariant();
        var words = text.Split([' ', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries).Length;

        var rubric = Parse(rubricJson);
        if (rubric.Count == 0) rubric = FallbackRubric(modelAnswer);

        var dimensions = new List<RubricDimensionScore>();
        var strengths = new List<string>();
        var weaknesses = new List<string>();

        // Presentation is shared across dimensions: length and structure say
        // something about the answer as a whole, not about one rubric line.
        var presentation = Presentation(words, HasStructure(text));

        foreach (var spec in rubric)
        {
            var keywords = spec.Keywords is { Count: > 0 } ? spec.Keywords : [spec.Dimension.ToLowerInvariant()];
            var hits = keywords.Where(k => lower.Contains(k.ToLowerInvariant())).ToList();

            // Full marks for covering half the listed concepts. A rubric lists
            // the things a good answer *could* mention; requiring every one of
            // them would punish an answer that makes the same points in other
            // words, which is most good answers.
            var expected = Math.Max(1, (int)Math.Ceiling(keywords.Count * 0.5));
            var coverage = Math.Min(1.0, (double)hits.Count / expected);

            // Coverage dominates; presentation stops a well-reasoned answer that
            // happens to use different vocabulary from scoring near zero, and
            // depth stops a keyword-stuffed one-liner from scoring like an essay.
            var score = (int)Math.Round(Math.Clamp(
                (coverage * 0.75 + presentation * 0.25) * 100 * DepthFactor(words), 0, 100));

            var missing = keywords.Except(hits, StringComparer.OrdinalIgnoreCase).Take(4).ToList();
            var comment = score >= 75
                ? $"Covered: {string.Join(", ", hits.Take(4))}."
                : missing.Count > 0
                    ? $"Not addressed: {string.Join(", ", missing)}."
                    : "Mentioned the area but without enough specifics.";

            dimensions.Add(new RubricDimensionScore(spec.Dimension, score, spec.Weight, comment));

            if (score >= 75) strengths.Add($"{spec.Dimension}: {comment}");
            else weaknesses.Add($"{spec.Dimension}: {comment} {spec.Guidance}".Trim());
        }

        var totalWeight = dimensions.Sum(d => d.Weight);
        var overall = totalWeight <= 0
            ? (int)Math.Round(dimensions.Average(d => (double)d.Score))
            : (int)Math.Round(dimensions.Sum(d => d.Score * d.Weight) / totalWeight);

        if (words < 25)
        {
            weaknesses.Insert(0, "The answer is too short to demonstrate architectural reasoning. Aim for 150–400 words covering context, options, decision and trade-offs.");
            overall = Math.Min(overall, 45);
        }
        else if (HasStructure(text))
        {
            strengths.Add("Structure: the answer is organised into distinct points, which reads well in an interview.");
            overall = Math.Min(100, overall + 3);
        }

        if (strengths.Count == 0)
            strengths.Add("You produced a complete attempt — compare it with the model answer and resubmit.");

        return new AnswerEvaluation(
            Math.Clamp(overall, 0, 100),
            dimensions,
            strengths.Take(6).ToList(),
            weaknesses.Take(6).ToList(),
            Disclaimers.DeterministicEvaluator);
    }

    /// <summary>Very short answers are capped; past ~120 words extra length stops helping.</summary>
    private static double DepthFactor(int words) => words switch
    {
        < 25 => 0.45,
        < 60 => 0.75,
        < 120 => 0.95,
        _ => 1.0
    };

    /// <summary>
    /// How well the answer is delivered, independent of whether the content is
    /// right: enough words to have reasoned, and visible structure.
    /// </summary>
    private static double Presentation(int words, bool structured)
    {
        var length = words switch
        {
            < 25 => 0.0,
            < 60 => 0.35,
            < 120 => 0.65,
            < 400 => 1.0,
            _ => 0.85   // rambling is not the same as thorough
        };
        return Math.Min(1.0, length + (structured ? 0.15 : 0));
    }

    private static bool HasStructure(string text) =>
        text.Contains('\n') || text.Contains("1.") || text.Contains("- ") ||
        text.Contains("First", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("Trade-off", StringComparison.OrdinalIgnoreCase);

    private static List<RubricSpec> Parse(string? rubricJson)
    {
        if (string.IsNullOrWhiteSpace(rubricJson)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<RubricSpec>>(rubricJson, Text.Json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>
    /// When a question ships without a rubric, score against the six dimensions
    /// the platform assesses everywhere else so feedback stays consistent.
    /// </summary>
    private static List<RubricSpec> FallbackRubric(string modelAnswer) =>
    [
        new("Architecture", 0.25, ["component", "layer", "service", "flow", "integration"], "Describe the components and how data moves between them."),
        new("Security", 0.20, ["authentication", "authorization", "identity", "secret", "encryption", "pii"], "Name the concrete controls, not just the word 'secure'."),
        new("Scalability", 0.15, ["scale", "load", "throughput", "queue", "cache", "partition"], "State the expected load and how the design absorbs it."),
        new("Cost", 0.15, ["cost", "pricing", "token", "budget", "tier"], "Estimate the cost drivers and how you keep them down."),
        new("Reliability", 0.15, ["availability", "retry", "failover", "monitor", "sla", "backup"], "Cover failure modes, retries and observability."),
        new("AI Design", 0.10, ["model", "prompt", "embedding", "rag", "grounding", "evaluation"], "Explain model choice, grounding and how you evaluate quality.")
    ];
}
