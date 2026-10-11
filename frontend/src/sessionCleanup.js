export async function runSessionCleanup(steps, onError = () => {}) {
  for (const [label, action] of steps) {
    try {
      await action();
    } catch (error) {
      onError(label, error);
    }
  }
}

export function runSessionTeardown(steps, onError = () => {}) {
  for (const [label, action] of steps) {
    try {
      const result = action();
      if (result && typeof result.then === "function") {
        result.catch((error) => onError(label, error));
      }
    } catch (error) {
      onError(label, error);
    }
  }
}