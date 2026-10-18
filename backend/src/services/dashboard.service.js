export function createDashboardService(databasePool) {
  return {
    async getForHr(hrUserId) {
      const summaryResult = await databasePool.query(
          `SELECT
             COUNT(DISTINCT o.id)::int AS total_offers,
             COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'published')::int AS published_offers,
             COUNT(DISTINCT a.id)::int AS total_applications,
             COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'shortlisted')::int AS shortlisted_applications,
             COUNT(DISTINCT a.id) FILTER (WHERE a.ai_status = 'completed')::int AS analyzed_applications,
             COALESCE(ROUND(AVG(COALESCE(a.final_score, a.semantic_score)) FILTER (WHERE a.ai_status = 'completed'), 1), 0) AS average_ai_score,
             COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'scheduled' AND i.scheduled_at >= NOW())::int AS upcoming_interviews,
             COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'completed')::int AS completed_interviews
           FROM job_offers o
           LEFT JOIN applications a ON a.job_offer_id = o.id
           LEFT JOIN interviews i ON i.application_id = a.id
           WHERE o.hr_user_id = $1`,
          [hrUserId],
        );
      const rankingResult = await databasePool.query(
          `SELECT a.id, COALESCE(a.final_score, a.semantic_score) AS final_score,
                  a.status, u.first_name, u.last_name, o.title
           FROM applications a
           JOIN job_offers o ON o.id = a.job_offer_id
           JOIN users u ON u.id = a.candidate_user_id
           WHERE o.hr_user_id = $1 AND a.ai_status = 'completed'
           ORDER BY COALESCE(a.final_score, a.semantic_score) DESC NULLS LAST, a.created_at DESC
           LIMIT 5`,
          [hrUserId],
        );
      const interviewsResult = await databasePool.query(
          `SELECT i.id, i.scheduled_at, i.duration_minutes, i.meeting_type,
                  u.first_name, u.last_name, o.title
           FROM interviews i
           JOIN applications a ON a.id = i.application_id
           JOIN job_offers o ON o.id = a.job_offer_id
           JOIN users u ON u.id = a.candidate_user_id
           WHERE o.hr_user_id = $1 AND i.status = 'scheduled' AND i.scheduled_at >= NOW()
           ORDER BY i.scheduled_at ASC
           LIMIT 5`,
          [hrUserId],
        );

      const summary = summaryResult.rows[0];
      return {
        summary: {
          totalOffers: summary.total_offers,
          publishedOffers: summary.published_offers,
          totalApplications: summary.total_applications,
          shortlistedApplications: summary.shortlisted_applications,
          analyzedApplications: summary.analyzed_applications,
          averageAiScore: Number(summary.average_ai_score),
          upcomingInterviews: summary.upcoming_interviews,
          completedInterviews: summary.completed_interviews,
        },
        ranking: rankingResult.rows.map((application) => ({
          id: application.id,
          score: Number(application.final_score),
          status: application.status,
          candidateName: `${application.first_name} ${application.last_name}`,
          offerTitle: application.title,
        })),
        upcomingInterviews: interviewsResult.rows.map((interview) => ({
          id: interview.id,
          scheduledAt: interview.scheduled_at,
          durationMinutes: interview.duration_minutes,
          meetingType: interview.meeting_type,
          candidateName: `${interview.first_name} ${interview.last_name}`,
          offerTitle: interview.title,
        })),
      };
    },
  };
}
