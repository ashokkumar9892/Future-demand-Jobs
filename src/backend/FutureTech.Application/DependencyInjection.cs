using FutureTech.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace FutureTech.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ICareerService, CareerService>();
        services.AddScoped<IRoadmapService, RoadmapService>();
        services.AddScoped<ICourseService, CourseService>();
        services.AddScoped<IStudyPlanGenerator, StudyPlanGenerator>();
        services.AddScoped<IStudyPlannerService, StudyPlannerService>();
        services.AddScoped<IPracticeService, PracticeService>();
        services.AddScoped<IArchitectureLabService, ArchitectureLabService>();
        services.AddScoped<ICodingLabService, CodingLabService>();
        services.AddScoped<IInterviewService, InterviewService>();
        services.AddScoped<IProjectService, ProjectService>();
        services.AddScoped<ICertificationService, CertificationService>();
        services.AddScoped<ISkillService, SkillService>();
        services.AddScoped<IReadinessService, ReadinessService>();
        services.AddScoped<IResumeService, ResumeService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IGamificationService, GamificationService>();
        services.AddScoped<INoteService, NoteService>();
        services.AddScoped<IBookmarkService, BookmarkService>();
        services.AddScoped<ISearchService, SearchService>();
        services.AddScoped<IFeedbackService, FeedbackService>();
        services.AddScoped<IEngagementService, EngagementService>();
        return services;
    }
}
