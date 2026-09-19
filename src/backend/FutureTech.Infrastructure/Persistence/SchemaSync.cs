using System.Data.Common;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FutureTech.Infrastructure.Persistence;

/// <summary>
/// Creates tables the model has gained since the database file was first made.
/// <para>
/// The platform starts with <c>EnsureCreated</c> rather than migrations, which
/// keeps first run friction-free but does nothing at all once the database
/// exists. Without this step, adding an entity would leave every existing
/// installation — including a developer's local SQLite file — throwing "no such
/// table" until it was deleted and reseeded, losing the learner data this
/// feature exists to report on.
/// </para>
/// <para>
/// It only ever adds missing tables and their indexes. It does not alter or
/// drop anything, so it cannot destroy data. Once real migrations are added,
/// delete this and call <c>MigrateAsync</c>.
/// </para>
/// </summary>
public static class SchemaSync
{
    private static readonly Regex TablePattern = new(
        """^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?<name>(?:"[^"]+"|\[[^\]]+\]|[\w$]+)(?:\.(?:"[^"]+"|\[[^\]]+\]|[\w$]+))?)""",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex IndexPattern = new(
        """^CREATE\s+(?:UNIQUE\s+)?INDEX\s+.*?\s+ON\s+(?<name>(?:"[^"]+"|\[[^\]]+\]|[\w$]+)(?:\.(?:"[^"]+"|\[[^\]]+\]|[\w$]+))?)""",
        RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.Singleline);

    public static async Task EnsureTablesAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        var existing = await ExistingTablesAsync(db, ct);

        // Nothing at all exists yet: EnsureCreated has just built the schema,
        // or is about to. Either way there is nothing to add.
        if (existing.Count == 0) return;

        var missing = db.Model.GetEntityTypes()
            .Select(e => e.GetTableName())
            .Where(name => !string.IsNullOrEmpty(name) && !existing.Contains(name!))
            .Select(name => name!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (missing.Count == 0) return;

        logger.LogInformation("Adding {Count} new table(s) to the existing database: {Tables}",
            missing.Count, string.Join(", ", missing.Order()));

        var applied = 0;
        foreach (var statement in Statements(db.Database.GenerateCreateScript()))
        {
            var target = TargetTable(statement);
            if (target is null || !missing.Contains(target)) continue;

            await db.Database.ExecuteSqlRawAsync(statement, ct);
            applied++;
        }

        logger.LogInformation("Applied {Count} schema statement(s).", applied);
    }

    /// <summary>Splits the generated script on statement terminators at end of line.</summary>
    private static IEnumerable<string> Statements(string script)
    {
        var buffer = new StringBuilder();

        foreach (var line in script.Replace("\r\n", "\n").Split('\n'))
        {
            var trimmed = line.Trim();

            // "GO" is a SQL Server batch separator, not a statement.
            if (trimmed.Equals("GO", StringComparison.OrdinalIgnoreCase))
            {
                if (Flush(buffer) is { } batch) yield return batch;
                continue;
            }

            buffer.AppendLine(line);
            if (!trimmed.EndsWith(';')) continue;

            if (Flush(buffer) is { } statement) yield return statement;
        }

        if (Flush(buffer) is { } tail) yield return tail;
    }

    private static string? Flush(StringBuilder buffer)
    {
        var text = buffer.ToString().Trim().TrimEnd(';').Trim();
        buffer.Clear();
        return text.Length == 0 ? null : text;
    }

    /// <summary>The table a CREATE TABLE or CREATE INDEX statement belongs to, unqualified.</summary>
    private static string? TargetTable(string statement)
    {
        var match = TablePattern.Match(statement);
        if (!match.Success) match = IndexPattern.Match(statement);
        if (!match.Success) return null;

        var name = match.Groups["name"].Value;
        // Drop any schema prefix, then the quoting around the identifier.
        var last = name.Split('.').Last();
        return last.Trim('"', '[', ']', '`');
    }

    private static async Task<HashSet<string>> ExistingTablesAsync(AppDbContext db, CancellationToken ct)
    {
        var sql = db.Database.IsSqlite()
            ? "SELECT name FROM sqlite_master WHERE type = 'table'"
            : "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()";

        var connection = db.Database.GetDbConnection();
        var opened = connection.State != System.Data.ConnectionState.Open;
        if (opened) await connection.OpenAsync(ct);

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = sql;

            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await using DbDataReader reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) names.Add(reader.GetString(0));
            return names;
        }
        finally
        {
            if (opened) await connection.CloseAsync();
        }
    }
}
