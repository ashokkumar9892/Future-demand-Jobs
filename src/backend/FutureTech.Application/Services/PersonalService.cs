using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface INoteService
{
    Task<IReadOnlyList<NoteDto>> ListAsync(string? scope, Guid? refId, string? search, bool importantOnly, CancellationToken ct = default);
    Task<NoteDto> CreateAsync(NoteUpsertRequest request, CancellationToken ct = default);
    Task<NoteDto> UpdateAsync(Guid id, NoteUpsertRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IBookmarkService
{
    Task<IReadOnlyList<BookmarkDto>> ListAsync(string? itemType, CancellationToken ct = default);
    Task<BookmarkDto> ToggleAsync(BookmarkRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface ISearchService
{
    Task<SearchResponseDto> SearchAsync(string query, int limit, CancellationToken ct = default);
}

public class NoteService(IAppDbContext db, ICurrentUser currentUser, IDateTimeProvider clock) : INoteService
{
    public async Task<IReadOnlyList<NoteDto>> ListAsync(
        string? scope, Guid? refId, string? search, bool importantOnly, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var query = db.Notes.AsNoTracking().Where(n => n.UserId == userId);

        if (!string.IsNullOrWhiteSpace(scope))
        {
            var parsed = Text.ParseEnum(scope, NoteScope.General);
            query = query.Where(n => n.Scope == parsed);
        }
        if (refId is { } id) query = query.Where(n => n.RefId == id);
        if (importantOnly) query = query.Where(n => n.IsImportant);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(n =>
                n.Title.ToLower().Contains(term) || n.Body.ToLower().Contains(term) || n.Tags.ToLower().Contains(term));
        }

        return await query.OrderByDescending(n => n.UpdatedAt ?? n.CreatedAt).Select(n => ToDto(n)).ToListAsync(ct);
    }

    public async Task<NoteDto> CreateAsync(NoteUpsertRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        if (string.IsNullOrWhiteSpace(request.Body) && string.IsNullOrWhiteSpace(request.Title))
            throw new AppException("A note needs a title or a body.");

        var note = new Note { UserId = userId };
        Apply(note, request);
        db.Notes.Add(note);
        await db.SaveChangesAsync(ct);
        return ToDto(note);
    }

    public async Task<NoteDto> UpdateAsync(Guid id, NoteUpsertRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var note = await db.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId, ct)
                   ?? throw AppException.NotFound("Note");
        Apply(note, request);
        note.UpdatedAt = clock.Now;
        await db.SaveChangesAsync(ct);
        return ToDto(note);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var note = await db.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId, ct)
                   ?? throw AppException.NotFound("Note");
        db.Notes.Remove(note);
        await db.SaveChangesAsync(ct);
    }

    private static void Apply(Note note, NoteUpsertRequest r)
    {
        note.Scope = Text.ParseEnum(r.Scope, NoteScope.General);
        note.RefId = r.RefId;
        note.RefTitle = r.RefTitle ?? string.Empty;
        note.Title = r.Title ?? string.Empty;
        note.Body = r.Body ?? string.Empty;
        note.IsImportant = r.IsImportant;
        note.IsQuestion = r.IsQuestion;
        note.CodeSnippet = r.CodeSnippet;
        note.Links = r.Links ?? string.Empty;
        note.Tags = r.Tags ?? string.Empty;
    }

    private static NoteDto ToDto(Note n) => new(
        n.Id, n.Scope.ToString(), n.RefId, n.RefTitle, n.Title, n.Body, n.IsImportant, n.IsQuestion,
        n.CodeSnippet, n.Links, n.Tags, n.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
        n.UpdatedAt?.ToString("yyyy-MM-dd HH:mm"));
}

public class BookmarkService(IAppDbContext db, ICurrentUser currentUser) : IBookmarkService
{
    public async Task<IReadOnlyList<BookmarkDto>> ListAsync(string? itemType, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var query = db.Bookmarks.AsNoTracking().Where(b => b.UserId == userId);
        if (!string.IsNullOrWhiteSpace(itemType))
        {
            var parsed = Text.ParseEnum(itemType, BookmarkItemType.Lesson);
            query = query.Where(b => b.ItemType == parsed);
        }

        return await query.OrderByDescending(b => b.CreatedAt)
            .Select(b => new BookmarkDto(
                b.Id, b.ItemType.ToString(), b.RefId, b.Title, b.Subtitle, b.DeepLink,
                b.CreatedAt.ToString("yyyy-MM-dd")))
            .ToListAsync(ct);
    }

    /// <summary>Adds the bookmark, or removes it when it already exists.</summary>
    public async Task<BookmarkDto> ToggleAsync(BookmarkRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var itemType = Text.ParseEnum(request.ItemType, BookmarkItemType.Lesson);

        var existing = await db.Bookmarks
            .FirstOrDefaultAsync(b => b.UserId == userId && b.ItemType == itemType && b.RefId == request.RefId, ct);

        if (existing is not null)
        {
            db.Bookmarks.Remove(existing);
            await db.SaveChangesAsync(ct);
            return new BookmarkDto(existing.Id, itemType.ToString(), request.RefId, request.Title,
                request.Subtitle, request.DeepLink, string.Empty);
        }

        var bookmark = new Bookmark
        {
            UserId = userId,
            ItemType = itemType,
            RefId = request.RefId,
            Title = request.Title,
            Subtitle = request.Subtitle,
            DeepLink = request.DeepLink
        };
        db.Bookmarks.Add(bookmark);
        await db.SaveChangesAsync(ct);

        return new BookmarkDto(bookmark.Id, itemType.ToString(), bookmark.RefId, bookmark.Title,
            bookmark.Subtitle, bookmark.DeepLink, bookmark.CreatedAt.ToString("yyyy-MM-dd"));
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var bookmark = await db.Bookmarks.FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId, ct)
                       ?? throw AppException.NotFound("Bookmark");
        db.Bookmarks.Remove(bookmark);
        await db.SaveChangesAsync(ct);
    }
}

public class SearchService(IAppDbContext db, ICurrentUser currentUser) : ISearchService
{
    public async Task<SearchResponseDto> SearchAsync(string query, int limit, CancellationToken ct = default)
    {
        var term = (query ?? string.Empty).Trim().ToLowerInvariant();
        if (term.Length < 2) return new SearchResponseDto(query ?? string.Empty, 0, []);

        var take = Math.Clamp(limit <= 0 ? 8 : limit, 1, 25);
        var results = new List<SearchResultDto>();

        results.AddRange(await db.Courses.AsNoTracking()
            .Where(c => c.Title.ToLower().Contains(term) || c.Summary.ToLower().Contains(term))
            .OrderBy(c => c.Order).Take(take)
            .Select(c => new SearchResultDto("Course", c.Id, c.Title, c.Summary, "/courses/" + c.Slug, "Course"))
            .ToListAsync(ct));

        results.AddRange(await db.Lessons.AsNoTracking()
            .Where(l => l.Title.ToLower().Contains(term) || l.ContentMarkdown.ToLower().Contains(term))
            .Take(take)
            .Select(l => new SearchResultDto("Lesson", l.Id, l.Title, l.Module!.Title, "/learn/" + l.Slug, "Lesson"))
            .ToListAsync(ct));

        results.AddRange(await db.Videos.AsNoTracking()
            .Where(v => v.Title.ToLower().Contains(term)).Take(take)
            .Select(v => new SearchResultDto("Video", v.Id, v.Title, v.Lesson!.Title, "/learn/" + v.Lesson.Slug, "Video"))
            .ToListAsync(ct));

        results.AddRange(await db.PracticeQuestions.AsNoTracking()
            .Where(q => q.Prompt.ToLower().Contains(term) || q.Tags.ToLower().Contains(term)).Take(take)
            .Select(q => new SearchResultDto("Practice", q.Id, q.Prompt, q.Category, "/practice/" + q.Id, "Practice"))
            .ToListAsync(ct));

        results.AddRange(await db.Projects.AsNoTracking()
            .Where(p => p.Title.ToLower().Contains(term) || p.Summary.ToLower().Contains(term) || p.TechStack.ToLower().Contains(term))
            .Take(take)
            .Select(p => new SearchResultDto("Project", p.Id, p.Title, p.TechStack, "/projects/" + p.Slug, "Project"))
            .ToListAsync(ct));

        results.AddRange(await db.CareerPaths.AsNoTracking()
            .Where(c => c.Title.ToLower().Contains(term) || c.ResumeKeywords.ToLower().Contains(term)).Take(take)
            .Select(c => new SearchResultDto("Career", c.Id, c.Title, c.Summary, "/careers/" + c.Slug, "Career"))
            .ToListAsync(ct));

        results.AddRange(await db.Skills.AsNoTracking()
            .Where(s => s.Name.ToLower().Contains(term)).Take(take)
            .Select(s => new SearchResultDto("Technology", s.Id, s.Name, s.Category.ToString(), "/skills", "Technology"))
            .ToListAsync(ct));

        results.AddRange(await db.InterviewQuestions.AsNoTracking()
            .Where(q => q.Question.ToLower().Contains(term)).Take(take)
            .Select(q => new SearchResultDto("Interview", q.Id, q.Question, q.Category.ToString(),
                "/interview-prep?question=" + q.Id, "Interview"))
            .ToListAsync(ct));

        results.AddRange(await db.CodingExercises.AsNoTracking()
            .Where(e => e.Title.ToLower().Contains(term) || e.Category.ToLower().Contains(term)).Take(take)
            .Select(e => new SearchResultDto("Coding Lab", e.Id, e.Title, e.Category, "/coding-labs/" + e.Slug, "Coding Lab"))
            .ToListAsync(ct));

        if (currentUser.UserId is { } userId)
            results.AddRange(await db.Notes.AsNoTracking()
                .Where(n => n.UserId == userId && (n.Title.ToLower().Contains(term) || n.Body.ToLower().Contains(term)))
                .Take(take)
                .Select(n => new SearchResultDto("Note", n.Id, n.Title, n.RefTitle, "/notes", "Note"))
                .ToListAsync(ct));

        return new SearchResponseDto(query!, results.Count, results);
    }
}
