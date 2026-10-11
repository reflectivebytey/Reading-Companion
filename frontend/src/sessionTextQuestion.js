export async function requestTextAnswer(fetchImpl, url, payload) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(response.status === 429 ? "Too many questions right now. Please try later." : "Text answer unavailable. Please retry.");
  const { answer } = await response.json();
  if (!answer) throw new Error("No answer received. Please retry.");
  return answer;
}