export function reportsForOwner(reports, userId) {
  if (!userId) return [];
  return reports.filter((report) => (report.ownerUserId || report.owner_user_id) === userId);
}