export function createDashboardService(databasePool) {
  return {
    async getForHr(hrUserId, { offerId = null } = {}) {
      const summaryResult = await databasePool.query(
          `SELECT
             COUNT(DISTINCT o.id)::int AS total_offers,
             COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'published')::int AS published_offers,
             COUNT(DISTINCT a.id)::int AS total_applications,
             COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'submitted')::int AS submitted_applications,
             COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'reviewed')::int AS reviewed_applications,
             COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'shortlisted')::int AS shortlisted_applications,
             COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'rejected')::int AS rejected_applications,
             COUNT(DISTINCT a.id) FILTER (WHERE a.ai_status = 'completed')::int AS analyzed_applications,
             COUNT(DISTINCT a.id) FILTER (
               WHERE a.ai_status = 'completed' AND ROUND(COALESCE(a.final_score, a.semantic_score)) = 0
             )::int AS zero_match_applications,
             COUNT(DISTINCT a.id) FILTER (
               WHERE a.ai_status = 'completed'
                 AND ROUND(COALESCE(a.final_score, a.semantic_score)) > 0
                 AND ROUND(COALESCE(a.final_score, a.semantic_score)) < 50
             )::int AS low_match_applications,
             COUNT(DISTINCT a.id) FILTER (
               WHERE a.ai_status = 'completed' AND ROUND(COALESCE(a.final_score, a.semantic_score)) >= 50
             )::int AS aligned_applications,
             COUNT(DISTINCT a.id) FILTER (
               WHERE a.ai_status <> 'completed' OR COALESCE(a.final_score, a.semantic_score) IS NULL
             )::int AS unavailable_match_applications,
             COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'scheduled' AND i.scheduled_at >= NOW())::int AS upcoming_interviews,
             COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'completed')::int AS completed_interviews
           FROM job_offers o
           LEFT JOIN applications a ON a.job_offer_id = o.id
           LEFT JOIN interviews i ON i.application_id = a.id
           WHERE o.hr_user_id = $1`,
          [hrUserId],
        );
      const offersResult = await databasePool.query(
          `SELECT o.id, o.title, o.status,
                  COUNT(a.id)::int AS application_count,
                  COUNT(a.id) FILTER (WHERE a.status = 'shortlisted')::int AS shortlisted_count
           FROM job_offers o
           LEFT JOIN applications a ON a.job_offer_id = o.id
           WHERE o.hr_user_id = $1
           GROUP BY o.id
           ORDER BY CASE o.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
                    o.created_at DESC`,
          [hrUserId],
        );
      const requestedOfferId = Number(offerId);
      const selectedOffer = offersResult.rows.find((offer) => Number(offer.id) === requestedOfferId)
        || offersResult.rows.find((offer) => offer.application_count > 0)
        || offersResult.rows[0]
        || null;
      const rankingResult = selectedOffer ? await databasePool.query(
          `SELECT a.id, COALESCE(a.final_score, a.semantic_score) AS final_score,
                  a.status, u.first_name, u.last_name, o.title
           FROM applications a
           JOIN job_offers o ON o.id = a.job_offer_id
           JOIN users u ON u.id = a.candidate_user_id
           WHERE o.hr_user_id = $1 AND o.id = $2 AND a.ai_status = 'completed'
           ORDER BY COALESCE(a.final_score, a.semantic_score) DESC NULLS LAST, a.created_at DESC
           LIMIT 5`,
          [hrUserId, selectedOffer.id],
        ) : { rows: [] };
      const priorityResult = await databasePool.query(
          `SELECT a.id, a.status, a.created_at, a.ai_status,
                  COALESCE(a.final_score, a.semantic_score) AS final_score,
                  u.first_name, u.last_name, o.title
           FROM applications a
           JOIN job_offers o ON o.id = a.job_offer_id
           JOIN users u ON u.id = a.candidate_user_id
           WHERE o.hr_user_id = $1 AND a.status IN ('submitted', 'reviewed')
           ORDER BY CASE a.status WHEN 'submitted' THEN 0 ELSE 1 END,
                    a.created_at ASC
           LIMIT 6`,
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
          submittedApplications: summary.submitted_applications,
          reviewedApplications: summary.reviewed_applications,
          shortlistedApplications: summary.shortlisted_applications,
          rejectedApplications: summary.rejected_applications,
          analyzedApplications: summary.analyzed_applications,
          zeroMatchApplications: summary.zero_match_applications || 0,
          lowMatchApplications: summary.low_match_applications || 0,
          alignedApplications: summary.aligned_applications || 0,
          unavailableMatchApplications: summary.unavailable_match_applications || 0,
          upcomingInterviews: summary.upcoming_interviews,
          completedInterviews: summary.completed_interviews,
        },
        pipeline: [
          { status: 'submitted', count: summary.submitted_applications },
          { status: 'reviewed', count: summary.reviewed_applications },
          { status: 'shortlisted', count: summary.shortlisted_applications },
          { status: 'rejected', count: summary.rejected_applications },
        ],
        offers: offersResult.rows.map((offer) => ({
          id: Number(offer.id),
          title: offer.title,
          status: offer.status,
          applicationCount: offer.application_count,
          shortlistedCount: offer.shortlisted_count,
        })),
        selectedOfferId: selectedOffer ? Number(selectedOffer.id) : null,
        ranking: rankingResult.rows.map((application) => ({
          id: application.id,
          score: Number(application.final_score),
          status: application.status,
          candidateName: `${application.first_name} ${application.last_name}`,
          offerTitle: application.title,
        })),
        priorityApplications: priorityResult.rows.map((application) => ({
          id: application.id,
          status: application.status,
          createdAt: application.created_at,
          aiStatus: application.ai_status,
          score: application.final_score === null ? null : Number(application.final_score),
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
