import { preloadDataset } from './data-loader.js';
import { configureMotion } from './motion.js';
import { applyTheme } from './theme.js';
import { getPreferences, subscribeToPreferences, updatePreferences } from './preferences.js';

export async function initializeApp(pageId, options = {}) {
  const [dataset, initialPreferences] = await Promise.all([
    preloadDataset(),
    Promise.resolve(getPreferences())
  ]);

  configureMotion(initialPreferences);
  applyTheme(initialPreferences);

  const context = {
    pageId,
    dataset,
    preferences: initialPreferences,
    updatePreferences
  };

  options.onReady?.(context);

  const unsubscribe = subscribeToPreferences((nextPreferences) => {
    context.preferences = nextPreferences;
    configureMotion(nextPreferences);
    applyTheme(nextPreferences);
    options.onPreferencesChange?.({ ...context, preferences: nextPreferences });
  });

  return {
    ...context,
    destroy() {
      unsubscribe();
    }
  };
}
