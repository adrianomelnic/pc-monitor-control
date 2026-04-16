// Legacy compatibility shim. Prefer using `useTheme()` from `@/context/ThemeContext`.
// This export reflects the ROG (default) palette so any module-level references
// that haven't been migrated still compile and render sensibly.
import { ROG_THEME } from "./themes";

export default {
  light: ROG_THEME.colors,
};
