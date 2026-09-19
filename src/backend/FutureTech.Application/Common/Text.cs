using System.Text.Json;

namespace FutureTech.Application.Common;

/// <summary>Small helpers for the newline-separated and JSON columns used across content tables.</summary>
public static class Text
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Splits a newline- (or pipe-) separated column into trimmed, non-empty lines.</summary>
    public static IReadOnlyList<string> Lines(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? Array.Empty<string>()
            : value.Replace("\r\n", "\n").Split(['\n', '|'], StringSplitOptions.RemoveEmptyEntries)
                   .Select(x => x.Trim()).Where(x => x.Length > 0).ToArray();

    public static IReadOnlyList<string> Csv(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? Array.Empty<string>()
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries)
                   .Select(x => x.Trim()).Where(x => x.Length > 0).ToArray();

    public static T? FromJson<T>(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return default;
        try { return JsonSerializer.Deserialize<T>(json, Json); }
        catch (JsonException) { return default; }
    }

    public static string ToJson<T>(T value) => JsonSerializer.Serialize(value, Json);

    /// <summary>Turns "AiReplacementRisk.VeryLow" style enum names into "Very Low" for the UI.</summary>
    public static string Humanize(Enum value)
    {
        var name = value.ToString();
        var sb = new System.Text.StringBuilder(name.Length + 4);
        for (var i = 0; i < name.Length; i++)
        {
            if (i > 0 && char.IsUpper(name[i]) && !char.IsUpper(name[i - 1])) sb.Append(' ');
            sb.Append(name[i]);
        }
        return sb.ToString();
    }

    public static TEnum ParseEnum<TEnum>(string? value, TEnum fallback) where TEnum : struct, Enum =>
        Enum.TryParse<TEnum>(value?.Replace(" ", string.Empty), true, out var parsed) ? parsed : fallback;

    public static string Money(int amount) => amount >= 1000 ? $"${amount / 1000}K" : $"${amount}";

    public static string SalaryRange(int min, int max) => $"{Money(min)}–{Money(max)}+";
}
