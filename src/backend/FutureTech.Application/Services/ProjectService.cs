using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IProjectService
{
    Task<IReadOnlyList<ProjectListItemDto>> ListAsync(CancellationToken ct = default);
    Task<ProjectDetailDto> GetAsync(string slug, CancellationToken ct = default);
    Task<ProjectDetailDto> SaveProgressAsync(Guid projectId, ProjectProgressRequest request, CancellationToken ct = default);
    Task<ProjectDetailDto> ToggleMilestoneAsync(Guid projectId, Guid milestoneId, CancellationToken ct = default);
}

public class ProjectService(
    IAppDbContext db, ICurrentUser currentUser, IDateTimeProvider clock, IGamificationService gamification) : IProjectService
{
    public async Task<IReadOnlyList<ProjectListItemDto>> ListAsync(CancellationToken ct = default)
    {
        var projects = await db.Projects.AsNoTracking().OrderBy(p => p.Order).ToListAsync(ct);
        var progress = await ProgressMapAsync(ct);

        return projects.Select(p =>
        {
            progress.TryGetValue(p.Id, out var up);
            return ToListItem(p, up);
        }).ToList();
    }

    public async Task<ProjectDetailDto> GetAsync(string slug, CancellationToken ct = default)
    {
        var project = await db.Projects.AsNoTracking().Include(p => p.Milestones)
            .FirstOrDefaultAsync(p => p.Slug == slug, ct) ?? throw AppException.NotFound("Project");
        return await BuildDetailAsync(project, ct);
    }

    public async Task<ProjectDetailDto> SaveProgressAsync(Guid projectId, ProjectProgressRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var project = await db.Projects.AsNoTracking().Include(p => p.Milestones)
            .FirstOrDefaultAsync(p => p.Id == projectId, ct) ?? throw AppException.NotFound("Project");

        var record = await RequireProgressAsync(userId, projectId, ct);
        var wasCompleted = record.Status == ProgressStatus.Completed;

        record.Status = Text.ParseEnum(request.Status, record.Status);
        record.RepoUrl = request.RepoUrl ?? record.RepoUrl;
        record.DemoUrl = request.DemoUrl ?? record.DemoUrl;
        record.Notes = request.Notes ?? record.Notes;
        record.UpdatedAt = clock.Now;
        if (record.Status != ProgressStatus.NotStarted && record.StartedAt is null) record.StartedAt = clock.Now;
        if (record.Status == ProgressStatus.Completed)
        {
            record.CompletedAt ??= clock.Now;
            record.PercentComplete = 100;
        }

        if (record.Status == ProgressStatus.Completed && !wasCompleted)
            gamification.Record(userId, Xp.ProjectCompleted, $"Project completed: {project.Title}",
                "project", projectId, 0, StudyActivityType.Project);

        await db.SaveChangesAsync(ct);
        await gamification.EvaluateBadgesAsync(userId, ct);
        await db.SaveChangesAsync(ct);
        return await BuildDetailAsync(project, ct);
    }

    public async Task<ProjectDetailDto> ToggleMilestoneAsync(Guid projectId, Guid milestoneId, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var project = await db.Projects.AsNoTracking().Include(p => p.Milestones)
            .FirstOrDefaultAsync(p => p.Id == projectId, ct) ?? throw AppException.NotFound("Project");

        var milestone = project.Milestones.FirstOrDefault(m => m.Id == milestoneId)
                        ?? throw AppException.NotFound("Milestone");

        var record = await RequireProgressAsync(userId, projectId, ct);
        var existing = await db.UserProjectMilestones
            .FirstOrDefaultAsync(m => m.UserProjectProgressId == record.Id && m.ProjectMilestoneId == milestoneId, ct);

        if (existing is null)
        {
            db.UserProjectMilestones.Add(new UserProjectMilestone
            {
                UserProjectProgressId = record.Id,
                ProjectMilestoneId = milestoneId
            });
            gamification.Record(userId, Xp.ProjectMilestone, $"Milestone: {milestone.Title}", "project", projectId,
                (int)Math.Round(milestone.EstimatedHours * 60), StudyActivityType.Project);
        }
        else
        {
            db.UserProjectMilestones.Remove(existing);
        }

        await db.SaveChangesAsync(ct);

        var done = await db.UserProjectMilestones.CountAsync(m => m.UserProjectProgressId == record.Id, ct);
        var total = project.Milestones.Count;
        record.PercentComplete = total == 0 ? 0 : (int)Math.Round(done * 100.0 / total);
        record.Status = record.PercentComplete switch
        {
            0 => ProgressStatus.NotStarted,
            100 => ProgressStatus.Completed,
            _ => ProgressStatus.InProgress
        };
        if (record.Status != ProgressStatus.NotStarted && record.StartedAt is null) record.StartedAt = clock.Now;
        if (record.Status == ProgressStatus.Completed && record.CompletedAt is null)
        {
            record.CompletedAt = clock.Now;
            gamification.Record(userId, Xp.ProjectCompleted, $"Project completed: {project.Title}",
                "project", projectId, 0, StudyActivityType.Project);
        }
        record.UpdatedAt = clock.Now;

        await db.SaveChangesAsync(ct);
        await gamification.EvaluateBadgesAsync(userId, ct);
        await db.SaveChangesAsync(ct);
        return await BuildDetailAsync(project, ct);
    }

    // ----- helpers -------------------------------------------------------

    private async Task<ProjectDetailDto> BuildDetailAsync(Project project, CancellationToken ct)
    {
        UserProjectProgress? record = null;
        var completedMilestones = new HashSet<Guid>();
        var bookmarked = false;

        if (currentUser.UserId is { } userId)
        {
            record = await db.UserProjectProgress.AsNoTracking()
                .FirstOrDefaultAsync(p => p.UserId == userId && p.ProjectId == project.Id, ct);
            if (record is not null)
                completedMilestones = (await db.UserProjectMilestones.AsNoTracking()
                    .Where(m => m.UserProjectProgressId == record.Id)
                    .Select(m => m.ProjectMilestoneId).ToListAsync(ct)).ToHashSet();
            bookmarked = await db.Bookmarks.AsNoTracking().AnyAsync(
                b => b.UserId == userId && b.ItemType == BookmarkItemType.Project && b.RefId == project.Id, ct);
        }

        var skillSlugs = Text.Csv(project.SkillSlugs);
        var skillNames = await db.Skills.AsNoTracking()
            .Where(s => skillSlugs.Contains(s.Slug)).Select(s => s.Name).ToListAsync(ct);

        return new ProjectDetailDto(
            ToListItem(project, record),
            project.BriefMarkdown,
            project.ArchitectureMermaid,
            Text.Lines(project.AcceptanceCriteria),
            Text.Lines(project.ResumeBullets),
            skillNames,
            project.Milestones.OrderBy(m => m.Order).Select(m => new ProjectMilestoneDto(
                m.Id, m.Order, m.Title, m.Description, m.EstimatedHours, completedMilestones.Contains(m.Id))).ToList(),
            record?.RepoUrl, record?.DemoUrl, record?.Notes ?? string.Empty, bookmarked);
    }

    private static ProjectListItemDto ToListItem(Project p, UserProjectProgress? progress) => new(
        p.Id, p.Order, p.Title, p.Slug, p.Summary, p.TechStack, Text.Humanize(p.Difficulty),
        p.EstimatedHours, (progress?.Status ?? ProgressStatus.NotStarted).ToString(), progress?.PercentComplete ?? 0);

    private async Task<Dictionary<Guid, UserProjectProgress>> ProgressMapAsync(CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId) return [];
        return await db.UserProjectProgress.AsNoTracking()
            .Where(p => p.UserId == userId).ToDictionaryAsync(p => p.ProjectId, p => p, ct);
    }

    private async Task<UserProjectProgress> RequireProgressAsync(Guid userId, Guid projectId, CancellationToken ct)
    {
        var record = await db.UserProjectProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.ProjectId == projectId, ct);
        if (record is not null) return record;

        record = new UserProjectProgress { UserId = userId, ProjectId = projectId, Status = ProgressStatus.NotStarted };
        db.UserProjectProgress.Add(record);
        await db.SaveChangesAsync(ct);
        return record;
    }
}
