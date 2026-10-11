export async function runSessionCleanup(steps, onError = () => {}) {
  for (const [label, action] of steps) {
    try {
      await action();
    } catch (error) {
      onError(label, error);
    }
  }
}