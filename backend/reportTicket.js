const STORAGE_FOLDERS = Object.freeze({
  bug: "Bug",
  issue: "Issue",
  enhance: "Improvement",
  feature: "New feature",
});

export function formatTicketNumber(value) {
  const ticketNumber = Number(value);
  if (!Number.isSafeInteger(ticketNumber) || ticketNumber < 1) {
    throw new Error("invalid_ticket_number");
  }
  return `RC-${String(ticketNumber).padStart(6, "0")}`;
}

export function screenshotObjectPath({ type, reporter, ticketNumber, index, count, extension, ownerUserId }) {
  const folder = STORAGE_FOLDERS[type];
  if (!folder) throw new Error("invalid_report_type");
  if (!Number.isInteger(index) || index < 0 || index >= count || !Number.isInteger(count) || count < 1 || count > 4) {
    throw new Error("invalid_screenshot_index");
  }
  if (!["jpg", "png"].includes(extension)) throw new Error("invalid_screenshot_extension");

  const username = String(reporter || "reader")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}-]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "reader";
  const ticket = formatTicketNumber(ticketNumber);
  const imageSuffix = count > 1 ? `_${index + 1}` : "";
  const owner = ownerUserId || "unowned";
  if (ownerUserId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerUserId)) {
    throw new Error("invalid_report_owner");
  }
  return `${owner}/${folder}/${username}_${ticket}${imageSuffix}.${extension}`;
}