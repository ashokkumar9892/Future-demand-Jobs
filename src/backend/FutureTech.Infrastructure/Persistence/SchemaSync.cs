using System.Data.Common;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
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
/// It adds missing tables with their indexes, and missing columns on tables
/// that already exist. It never alters or drops anything already there, so it
/// cannot destroy data. Once real migrations are added, delete this and call
/// <c>MigrateAsync</c>.
/// </para>
/// <para>
/// Columns matter as much as tables: a property added to an existing entity is
/// invisible to <c>EnsureCreated</c>, and every read of that entity then fails
/// with "no such column" on installations that predate the change — including
/// ones upgraded only a day earlier.
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

        if (missing.Count > 0)
        {
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

        await EnsureColumnsAsync(db, logger, existing, missing, ct);
    }

    /// <summary>
    /// Adds columns the model has gained on tables that already exist.
    /// <para>
    /// Every column is added nullable and with an explicit default, even where
    /// the model forbids null. Rows written before the column existed have no
    /// value for it, and a non-nullable property read back as NULL would throw
    /// on every one of them.
    /// </para>
    /// </summary>
    private static async Task EnsureColumnsAsync(
        AppDbContext db, ILogger logger, HashSet<string> existing, HashSet<string> justCreated,
        CancellationToken ct)
    {
        var added = 0;

        foreach (var entity in db.Model.GetEntityTypes())
        {
            var table = entity.GetTableName();
            if (string.IsNullOrEmpty(table)) continue;

            // A table created moments ago already matches the model.
            if (!existing.Contains(table) || justCreated.Contains(table)) continue;

            var storeObject = StoreObjectIdentifier.Table(table, entity.GetSchema());
            var present = await ExistingColumnsAsync(db, table, ct);
            if (present.Count == 0) continue;

            foreach (var property in entity.GetProperties())
            {
                var column = property.GetColumnName(storeObject);
                if (string.IsNullOrEmpty(column) || present.Contains(column)) continue;

                var type = property.GetColumnType(storeObject);
                if (string.IsNullOrEmpty(type)) continue;

                var sql = "ALTER TABLE " + Quote(db, table) + " ADD " + Quote(db, column) +
                          " " + type + " NULL DEFAULT " + DefaultLiteral(property);

                logger.LogInformation("Adding column {Table}.{Column} ({Type})", table, column, type);
                await db.Database.ExecuteSqlRawAsync(sql, ct);
                added++;
            }
        }

        if (added > 0) logger.LogInformation("Added {Count} missing column(s).", added);
    }

    private static string Quote(AppDbContext db, string identifier) =>
        db.Database.IsSqlServer() ? "[" + identifier + "]" : "\"" + identifier + "\"";

    /// <summary>
    /// A literal valid for the column's stored form. Dates and GUIDs persist
    /// here as strings, so a blank default would read back as an unparseable
    /// value rather than as "not set".
    /// </summary>
    private static string DefaultLiteral(IProperty property)
    {
        var model = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
        var provider = property.GetTypeMapping().Converter?.ProviderClrType ?? model;

        if (model == typeof(DateTimeOffset) || model == typeof(DateTime))
            return provider == typeof(string) ? "'0001-01-01T00:00:00.0000000+00:00'" : "'0001-01-01'";
        if (model == typeof(DateOnly)) return "'0001-01-01'";
        if (model == typeof(Guid)) return "'00000000-0000-0000-0000-000000000000'";
        if (model == typeof(bool)) return provider == typeof(string) ? "'False'" : "0";
        if (model.IsEnum) return "''";
        return provider == typeof(string) ? "''" : "0";
    }

    private static async Task<HashSet<string>> ExistingColumnsAsync(
        AppDbContext db, string table, CancellationToken ct)
    {
        var sql = db.Database.IsSqlite()
            ? "SELECT name FROM pragma_table_info('" + table.Replace("'", "''") + "')"
            : "SELECT column_name FROM information_schema.columns WHERE table_name = @table";

        var connection = db.Database.GetDbConnection();
        var opened = connection.State != System.Data.ConnectionState.Open;
        if (opened) await connection.OpenAsync(ct);

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = sql;
            if (!db.Database.IsSqlite())
            {
                var parameter = command.CreateParameter();
                parameter.ParameterName = "@table";
                parameter.Value = table;
                command.Parameters.Add(parameter);
            }

            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) names.Add(reader.GetString(0));
            return names;
        }
        finally
        {
            if (opened) await connection.CloseAsync();
        }
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
        // current_schema() is PostgreSQL/SQLite syntax; SQL Server spells it
        // SCHEMA_NAME(). Getting this wrong takes the whole API down at startup,
        // because this runs before anything is served.
        var sql =
            db.Database.IsSqlite()
                ? "SELECT name FROM sqlite_master WHERE type = 'table'"
                : db.Database.IsSqlServer()
                    ? "SELECT table_name FROM information_schema.tables WHERE table_schema = SCHEMA_NAME()"
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
